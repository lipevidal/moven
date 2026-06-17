import { supabase } from '../../../database/supabase';

export async function removeFriend(friendId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuário não encontrado.');

  const { data: friendship, error: findError } = await supabase
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${user.id},receiver_id.eq.${friendId}),and(requester_id.eq.${friendId},receiver_id.eq.${user.id})`,
    )
    .maybeSingle();

  if (findError) throw findError;

  if (!friendship) {
    throw new Error('Amizade não encontrada.');
  }

  const { error: deleteError } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendship.id);

  if (deleteError) throw deleteError;
}