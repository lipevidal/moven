import { supabase } from '../../../database/supabase';

export async function getFriendshipStats() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { friendsCount: 0, requestsCount: 0 };

  const { count: friendsCount } = await supabase
    .from('friendships')
    .select('id', { count: 'exact', head: true })
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq('status', 'accepted');

  const { count: requestsCount } = await supabase
    .from('friendships')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', user.id)
    .eq('status', 'pending');

  return {
    friendsCount: friendsCount ?? 0,
    requestsCount: requestsCount ?? 0,
  };
}