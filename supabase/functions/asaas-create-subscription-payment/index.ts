declare const Deno: {
  serve: (
    handler: (req: Request) => Response | Promise<Response>,
  ) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

// @ts-ignore - import remoto usado por Supabase Edge Functions/Deno
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function ok(body: Record<string, unknown>) {
  return json({ ok: true, ...body }, 200);
}

function fail(message: string, code = "error", details?: unknown) {
  console.log("asaas-create-recurring-subscription:", {
    ok: false,
    code,
    message,
    details,
  });

  return json(
    {
      ok: false,
      error: code,
      message,
      details,
    },
    200,
  );
}

function onlyDigits(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function readBody(req: Request) {
  try {
    const text = await req.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function asaasRequest(path: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  const baseUrl =
    Deno.env.get("ASAAS_BASE_URL") || "https://api-sandbox.asaas.com/v3";

  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada nas secrets do Supabase.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "MovenApp/1.0",
      access_token: apiKey,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message =
      data?.errors?.[0]?.description ||
      data?.message ||
      data?.error ||
      `Asaas retornou HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return json({ ok: true }, 200);
    }

    if (req.method !== "POST") {
      return fail("Método não permitido. Use POST.", "method_not_allowed");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) {
      return fail("SUPABASE_URL não configurada.", "missing_supabase_url");
    }

    if (!serviceRoleKey) {
      return fail(
        "SUPABASE_SERVICE_ROLE_KEY não configurada. Use a chave service_role do Supabase.",
        "missing_service_role_key",
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();

    if (!jwt) {
      return fail(
        "Usuário não autenticado. O app não enviou o token da sessão.",
        "missing_user_jwt",
      );
    }

    const body = await readBody(req);
    const cpfCnpjFromApp = onlyDigits(
      body?.cpfCnpj || body?.cpf_cnpj || body?.document,
    );

    // UNDEFINED deixa o usuário escolher Pix, boleto ou cartão no ambiente do Asaas.
    // Se você quiser obrigar Pix: envie billingType: "PIX".
    // Para cartão recorrente automático, o cartão precisa ser informado/validado no fluxo do Asaas.
    const billingType = String(body?.billingType || "UNDEFINED").toUpperCase();

    const allowedBillingTypes = ["UNDEFINED", "BOLETO", "PIX", "CREDIT_CARD"];

    if (!allowedBillingTypes.includes(billingType)) {
      return fail("Forma de pagamento inválida.", "invalid_billing_type");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(jwt);

    if (userError || !userData?.user?.id) {
      return fail(
        "Sessão inválida. Saia do app e entre novamente.",
        "invalid_user_session",
        userError,
      );
    }

    const user = userData.user;
    const userId = user.id;

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("subscription_settings")
      .select("monthly_price, payment_due_days, grace_period_days")
      .eq("id", true)
      .maybeSingle();

    if (settingsError) {
      return fail(
        "Erro ao buscar subscription_settings. Rode os SQLs de assinatura.",
        "settings_error",
        settingsError,
      );
    }

    const monthlyPrice = Number(settings?.monthly_price ?? 29.9);
    const paymentDueDays = Number(settings?.payment_due_days ?? 1);
    const gracePeriodDays = Number(settings?.grace_period_days ?? 7);

    if (!monthlyPrice || monthlyPrice <= 0) {
      return fail(
        "Valor da mensalidade inválido. Configure no painel admin.",
        "invalid_monthly_price",
      );
    }

    const { data: activeAsaasSubscription } = await supabaseAdmin
      .from("subscription_asaas_subscriptions")
      .select("asaas_subscription_id, status")
      .eq("user_id", userId)
      .in("status", ["ACTIVE", "active", "created", "CREATED"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeAsaasSubscription?.asaas_subscription_id) {
      return ok({
        alreadyExists: true,
        subscriptionId: activeAsaasSubscription.asaas_subscription_id,
        message: "Você já possui uma assinatura recorrente criada.",
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return fail("Erro ao buscar perfil do usuário.", "profile_error", profileError);
    }

    const customerName =
      profile?.full_name ||
      profile?.name ||
      profile?.username ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      "Cliente MovenApp";

    const customerEmail =
      profile?.email || user.email || user.user_metadata?.email || "";

    const cpfCnpjFromProfile = onlyDigits(
      profile?.cpf_cnpj || profile?.cpf || profile?.cnpj,
    );

    const cpfCnpj = cpfCnpjFromApp || cpfCnpjFromProfile;

    if (!customerEmail) {
      return fail("Não encontrei e-mail do usuário.", "missing_email");
    }

    if (!cpfCnpj) {
      return fail("Informe CPF ou CNPJ para criar a assinatura.", "missing_cpf_cnpj");
    }

    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return fail(
        "CPF/CNPJ inválido. Informe 11 dígitos para CPF ou 14 para CNPJ.",
        "invalid_cpf_cnpj",
      );
    }

    if (cpfCnpjFromApp && cpfCnpjFromApp !== cpfCnpjFromProfile) {
      const { error: documentUpdateError } = await supabaseAdmin
        .from("profiles")
        .update({ cpf_cnpj: cpfCnpjFromApp })
        .eq("id", userId);

      if (documentUpdateError) {
        console.log("Não salvou cpf_cnpj no perfil:", documentUpdateError);
      }
    }

    const { data: storedCustomer, error: customerSelectError } =
      await supabaseAdmin
        .from("subscription_asaas_customers")
        .select("asaas_customer_id")
        .eq("user_id", userId)
        .maybeSingle();

    if (customerSelectError) {
      return fail(
        "Erro ao buscar cliente Asaas salvo.",
        "customer_select_error",
        customerSelectError,
      );
    }

    let asaasCustomerId = storedCustomer?.asaas_customer_id || "";

    if (!asaasCustomerId) {
      const customer = await asaasRequest("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: customerName,
          email: customerEmail,
          cpfCnpj,
          externalReference: userId,
          notificationDisabled: false,
        }),
      });

      asaasCustomerId = customer?.id;

      if (!asaasCustomerId) {
        return fail("Asaas não retornou o ID do cliente.", "missing_customer_id", customer);
      }

      const { error: customerUpsertError } = await supabaseAdmin
        .from("subscription_asaas_customers")
        .upsert({
          user_id: userId,
          asaas_customer_id: asaasCustomerId,
        });

      if (customerUpsertError) {
        return fail(
          "Cliente criado no Asaas, mas não foi salvo no Supabase.",
          "customer_upsert_error",
          customerUpsertError,
        );
      }
    }

    const externalReference = `movenapp-recurring-${userId}-${Date.now()}`;

    // Usa payment_due_days para assinatura imediata. Se quiser trial real,
    // troque para gracePeriodDays.
    const nextDueDate = toDateKey(addDays(new Date(), paymentDueDays));

    const subscription = await asaasRequest("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType,
        value: monthlyPrice,
        nextDueDate,
        cycle: "MONTHLY",
        description: "Assinatura mensal MovenApp",
        externalReference,
      }),
    });

    const asaasSubscriptionId = subscription?.id;

    if (!asaasSubscriptionId) {
      return fail(
        "Asaas não retornou o ID da assinatura.",
        "missing_subscription_id",
        subscription,
      );
    }

    const { error: saveSubscriptionError } = await supabaseAdmin
      .from("subscription_asaas_subscriptions")
      .insert({
        user_id: userId,
        asaas_subscription_id: asaasSubscriptionId,
        asaas_customer_id: asaasCustomerId,
        status: subscription.status || "created",
        billing_type: billingType,
        cycle: "MONTHLY",
        amount: monthlyPrice,
        next_due_date: nextDueDate,
        external_reference: externalReference,
        raw_payload: subscription,
      });

    if (saveSubscriptionError) {
      return fail(
        "Assinatura criada no Asaas, mas não foi salva no Supabase.",
        "save_subscription_error",
        saveSubscriptionError,
      );
    }

    await supabaseAdmin
      .from("user_subscriptions")
      .update({
        asaas_subscription_id: asaasSubscriptionId,
        asaas_subscription_status: subscription.status || "created",
      })
      .eq("user_id", userId);

    // A assinatura não retorna necessariamente o ID/link da primeira cobrança.
    // Então consultamos as cobranças geradas pela assinatura.
    let firstPayment: any = null;

    try {
      const subscriptionPayments = await asaasRequest(
        `/subscriptions/${asaasSubscriptionId}/payments`,
        { method: "GET" },
      );

      firstPayment =
        subscriptionPayments?.data?.[0] ||
        subscriptionPayments?.payments?.[0] ||
        null;

      if (firstPayment?.id) {
        await supabaseAdmin.from("subscription_payments").upsert({
          user_id: userId,
          asaas_payment_id: firstPayment.id,
          asaas_customer_id: asaasCustomerId,
          asaas_subscription_id: asaasSubscriptionId,
          status: firstPayment.status || "created",
          billing_type: firstPayment.billingType || billingType,
          amount: Number(firstPayment.value ?? monthlyPrice),
          due_date: firstPayment.dueDate || nextDueDate,
          invoice_url: firstPayment.invoiceUrl || null,
          bank_slip_url: firstPayment.bankSlipUrl || null,
          external_reference:
            firstPayment.externalReference ||
            `${externalReference}-payment-${firstPayment.id}`,
          raw_payload: firstPayment,
        });
      }
    } catch (paymentError) {
      console.log("Não foi possível buscar primeira cobrança:", paymentError);
    }

    return ok({
      subscriptionId: asaasSubscriptionId,
      subscriptionStatus: subscription.status,
      firstPaymentId: firstPayment?.id || null,
      invoiceUrl: firstPayment?.invoiceUrl || null,
      bankSlipUrl: firstPayment?.bankSlipUrl || null,
      value: monthlyPrice,
      nextDueDate,
      message:
        "Assinatura recorrente criada. A ativação acontece quando o primeiro pagamento for confirmado pelo webhook.",
    });
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Erro inesperado ao criar assinatura recorrente.",
      "unexpected_error",
    );
  }
});
