import { supabase } from '../../../database/supabase';

export async function getUnreadNotificationsCount() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return 0;
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
