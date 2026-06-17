import { supabase } from '../../../database/supabase';

export async function getFriendsTimeline() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: friendships, error: friendshipError } = await supabase
    .from('friendships')
    .select('requester_id, receiver_id')
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq('status', 'accepted');

  if (friendshipError) throw friendshipError;

  const friendIds = (friendships ?? []).map((item) =>
    item.requester_id === user.id ? item.receiver_id : item.requester_id,
  );

  const { data: blocks, error: blocksError } = await supabase
    .from('user_blocks')
    .select('blocked_id, blocker_id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

  if (blocksError) throw blocksError;

  const blockedIds = (blocks ?? []).map((item) =>
    item.blocker_id === user.id ? item.blocked_id : item.blocker_id,
  );

  const visibleFriendIds = friendIds.filter(
    (id) => !blockedIds.includes(id),
  );

  const visibleUserIds = [user.id, ...visibleFriendIds];

  const { data: results, error } = await supabase
    .from('shared_results')
    .select(`
      *,
      user:profiles (
        id,
        name,
        full_name,
        avatar_url
      )
    `)
    .in('user_id', visibleUserIds)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return results ?? [];
}