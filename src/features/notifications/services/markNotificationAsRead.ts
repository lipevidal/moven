import { supabase } from '../../../database/supabase';

export async function markNotificationAsRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({
      read: true,
    })
    .eq('id', notificationId);

  if (error) {
    throw error;
  }

  return true;
}

export async function markAllNotificationsAsRead() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return true;
  }

  const { error } = await supabase
    .from('notifications')
    .update({
      read: true,
    })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) {
    throw error;
  }

  return true;
}
