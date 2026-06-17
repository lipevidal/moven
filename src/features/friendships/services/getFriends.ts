import { supabase } from '../../../database/supabase';

export async function getFriends() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('id, requester_id, receiver_id')
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq('status', 'accepted');

  if (error) throw error;

  const friendIds = (friendships ?? []).map((item) =>
    item.requester_id === user.id ? item.receiver_id : item.requester_id,
  );

  if (friendIds.length === 0) return [];

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

  if (visibleFriendIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, full_name, avatar_url, bio')
    .in('id', visibleFriendIds);

  return profiles ?? [];
}