import { supabase } from '../../../database/supabase';

export async function getNotifications() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('notifications')
    .select(
      `
      id,
      user_id,
      title,
      message,
      type,
      read,
      reference_id,
      created_at
      `,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return data ?? [];
}
