import { supabase } from '../../../database/supabase';

export async function respondFriendRequest(
  friendshipId: string,
  status: 'accepted' | 'rejected',
) {
  const { error } = await supabase
    .from('friendships')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', friendshipId);

  if (error) throw error;
}