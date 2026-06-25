import { supabase } from '../../../database/supabase';

export async function getUnreadCount() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count, error } =
    await supabase
      .from('notifications')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', user.id)
      .eq('read', false);

  if (error) throw error;

  return count ?? 0;
}