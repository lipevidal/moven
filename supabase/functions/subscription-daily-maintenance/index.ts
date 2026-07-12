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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const maintenanceSecret = Deno.env.get("SUBSCRIPTION_MAINTENANCE_SECRET");
    const receivedSecret = req.headers.get("x-maintenance-secret");

    if (maintenanceSecret && receivedSecret !== maintenanceSecret) {
      return jsonResponse({ error: "Não autorizado." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data: subscriptions, error } = await supabaseAdmin
      .from("user_subscriptions")
      .select("user_id, status, current_period_end, deletion_scheduled_at")
      .neq("status", "deleted");

    if (error) throw error;

    const now = new Date();
    let inactivated = 0;
    let deleted = 0;

    for (const subscription of subscriptions ?? []) {
      const periodEnd = new Date(subscription.current_period_end);

      if (
        (subscription.status === "trial" || subscription.status === "active") &&
        periodEnd.getTime() < now.getTime()
      ) {
        const { data: settings } = await supabaseAdmin
          .from("subscription_settings")
          .select("inactive_delete_after_days")
          .eq("id", true)
          .single();

        const deleteAfterDays = Number(settings?.inactive_delete_after_days ?? 80);
        const deletionScheduledAt = new Date(periodEnd);
        deletionScheduledAt.setDate(deletionScheduledAt.getDate() + deleteAfterDays);

        await supabaseAdmin
          .from("user_subscriptions")
          .update({
            status: "inactive",
            inactive_since: subscription.current_period_end,
            deletion_scheduled_at: deletionScheduledAt.toISOString(),
          })
          .eq("user_id", subscription.user_id);

        inactivated += 1;
      }

      if (
        subscription.status === "inactive" &&
        subscription.deletion_scheduled_at &&
        new Date(subscription.deletion_scheduled_at).getTime() <= now.getTime()
      ) {
        await supabaseAdmin
          .from("user_subscriptions")
          .update({
            status: "deleted",
            deleted_at: now.toISOString(),
          })
          .eq("user_id", subscription.user_id);

        const { error: deleteUserError } =
          await supabaseAdmin.auth.admin.deleteUser(subscription.user_id);

        if (deleteUserError) {
          console.log("Erro ao deletar usuário Auth:", subscription.user_id, deleteUserError);
        } else {
          deleted += 1;
        }
      }
    }

    return jsonResponse({
      ok: true,
      checked: subscriptions?.length ?? 0,
      inactivated,
      deleted,
    });
  } catch (error) {
    console.log("Erro na manutenção de assinaturas:", error);

    return jsonResponse(
      {
        ok: false,
        error: "maintenance_failed",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível executar manutenção.",
      },
      400,
    );
  }
});
