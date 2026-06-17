import { supabase } from '../../../database/supabase';

export async function cancelFriendRequest(friendshipId: string) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .select();

  if (error) throw error;
}