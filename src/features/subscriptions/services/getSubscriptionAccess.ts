import { supabase } from "../../../database/supabase";

export type SubscriptionAccess = {
  user_id: string;
  status: "trial" | "active" | "inactive" | "deleted";
  can_create: boolean;
  monthly_price: number;
  current_period_end: string;
  days_until_due: number;
  days_inactive: number;
  days_until_deletion: number | null;
  show_payment_alert: boolean;
  show_deletion_warning: boolean;
  alert_title: string;
  alert_message: string;
};

export async function getSubscriptionAccess(): Promise<SubscriptionAccess | null> {
  const { data, error } = await supabase.rpc("get_my_subscription_access");

  if (error) {
    console.log("Erro ao carregar assinatura:", error);
    throw error;
  }

  const access = Array.isArray(data) ? data[0] : data;

  return access ?? null;
}
