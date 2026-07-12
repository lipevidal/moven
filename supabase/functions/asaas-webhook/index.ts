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
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
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

function onlyDigits(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return json({ ok: true });
    }

    if (req.method !== "POST") {
      return json({ ok: false, message: "Método não permitido." }, 200);
    }

    const configuredToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token") || "";

    if (configuredToken && receivedToken !== configuredToken) {
      return json({ ok: false, message: "Token do webhook inválido." }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        {
          ok: false,
          message: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.",
        },
        200,
      );
    }

    const payload = await req.json();
    const event = String(payload?.event || "");
    const payment = payload?.payment || {};
    const subscription = payload?.subscription || payment?.subscription || {};

    const paymentId = String(payment?.id || "");
    const asaasSubscriptionId = String(
      payment?.subscription ||
        subscription?.id ||
        payload?.subscription?.id ||
        "",
    );

    const eventId =
      String(payload?.id || "") ||
      `${event}-${paymentId || asaasSubscriptionId || Date.now()}`;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: existingEvent } = await supabaseAdmin
      .from("asaas_webhook_events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (existingEvent?.id) {
      return json({ ok: true, duplicated: true });
    }

    await supabaseAdmin.from("asaas_webhook_events").insert({
      id: eventId,
      event,
      payment_id: paymentId || null,
      payload,
    });

    if (event.startsWith("SUBSCRIPTION_") && asaasSubscriptionId) {
      const nextStatus =
        event === "SUBSCRIPTION_DELETED"
          ? "deleted"
          : event === "SUBSCRIPTION_INACTIVATED"
            ? "inactive"
            : String(subscription?.status || event).toLowerCase();

      await supabaseAdmin.rpc("mark_asaas_subscription_inactive", {
        p_asaas_subscription_id: asaasSubscriptionId,
        p_status: nextStatus,
      });
    }

    if (paymentId) {
      const { data: savedSubscription } = await supabaseAdmin
        .from("subscription_asaas_subscriptions")
        .select("user_id, asaas_customer_id")
        .eq("asaas_subscription_id", asaasSubscriptionId)
        .maybeSingle();

      if (savedSubscription?.user_id) {
        await supabaseAdmin.from("subscription_payments").upsert({
          user_id: savedSubscription.user_id,
          asaas_payment_id: paymentId,
          asaas_customer_id:
            payment?.customer || savedSubscription.asaas_customer_id || null,
          asaas_subscription_id: asaasSubscriptionId || null,
          status: payment?.status || event,
          billing_type: payment?.billingType || "UNDEFINED",
          amount: Number(payment?.value ?? 0),
          due_date: payment?.dueDate || new Date().toISOString().slice(0, 10),
          invoice_url: payment?.invoiceUrl || null,
          bank_slip_url: payment?.bankSlipUrl || null,
          external_reference:
            payment?.externalReference || `webhook-${paymentId}`,
          raw_payload: payment,
          paid_at:
            event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED"
              ? new Date().toISOString()
              : null,
        });
      }
    }

    if (
      (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") &&
      paymentId &&
      asaasSubscriptionId
    ) {
      await supabaseAdmin.rpc("apply_recurring_subscription_payment", {
        p_asaas_payment_id: paymentId,
        p_asaas_subscription_id: asaasSubscriptionId,
        p_paid_at: new Date().toISOString(),
      });
    }

    if (
      (event === "PAYMENT_OVERDUE" ||
        event === "PAYMENT_DELETED" ||
        event === "PAYMENT_REFUNDED" ||
        event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED") &&
      paymentId
    ) {
      await supabaseAdmin
        .from("subscription_payments")
        .update({
          status: payment?.status || event,
          raw_payload: payment,
        })
        .eq("asaas_payment_id", paymentId);
    }

    return json({ ok: true });
  } catch (error) {
    console.log("asaas-webhook error:", error);

    // Responde 200 para não travar a fila do Asaas, mas registra nos logs.
    return json({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Erro inesperado no webhook Asaas.",
    });
  }
});
