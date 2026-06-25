import { supabase } from '../../../database/supabase';

export async function getNotificationSettings() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
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
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
