import { supabase } from '../../../database/supabase';

export type FriendshipStatus =
  | 'self'
  | 'friends'
  | 'none'
  | 'request_sent'
  | 'request_received'
  | 'blocked';

export async function getFriendshipStatus(otherUserId: string): Promise<{
  status: FriendshipStatus;
  friendshipId: string | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: 'none',
      friendshipId: null,
    };
  }

  if (user.id === otherUserId) {
    return {
      status: 'self',
      friendshipId: null,
    };
  }

  const { data: blocks } = await supabase
    .from('user_blocks')
    .select('id, blocker_id, blocked_id')
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${user.id})`,
    )
    .maybeSingle();

  if (blocks) {
    return {
      status: 'blocked',
      friendshipId: null,
    };
  }

  const { data: friendship } = await supabase
    .from('friendships')
    .select('id, requester_id, receiver_id, status')
    .or(
      `and(requester_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},receiver_id.eq.${user.id})`,
    )
    .maybeSingle();

  if (!friendship) {
    return {
      status: 'none',
      friendshipId: null,
    };
  }

  if (friendship.status === 'accepted') {
    return {
      status: 'friends',
      friendshipId: friendship.id,
    };
  }

  if (friendship.status === 'pending') {
    if (friendship.requester_id === user.id) {
      return {
        status: 'request_sent',
        friendshipId: friendship.id,
      };
    }

    return {
      status: 'request_received',
      friendshipId: friendship.id,
    };
  }

  return {
    status: 'none',
    friendshipId: friendship.id,
  };
}