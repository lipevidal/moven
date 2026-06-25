import { supabase } from "../../../database/supabase";

type NotificationSettingsPayload = {
  notification_goals: boolean;
  notification_revision: boolean;
  notification_ipva: boolean;
  notification_community: boolean;
  notification_news: boolean;
};

export async function updateNotificationSettings(
  payload: NotificationSettingsPayload,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select(
      `
      id,
      notification_goals,
      notification_revision,
      notification_ipva,
      notification_community,
      notification_news
      `,
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
}
