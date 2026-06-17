import { supabase } from '../../../database/supabase';

export async function sendFriendRequest(receiverId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  if (user.id === receiverId) {
    throw new Error('Você não pode adicionar você mesmo.');
  }

  const { data: existing, error: findError } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `and(requester_id.eq.${user.id},receiver_id.eq.${receiverId}),and(requester_id.eq.${receiverId},receiver_id.eq.${user.id})`,
    )
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    if (existing.status === 'accepted') {
      throw new Error('Vocês já são amigos.');
    }

    if (existing.status === 'pending') {
      throw new Error('Já existe uma solicitação pendente.');
    }

    // reutiliza solicitação cancelada/rejeitada
    const { error: updateError } = await supabase
      .from('friendships')
      .update({
        requester_id: user.id,
        receiver_id: receiverId,
        status: 'pending',
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;

    return;
  }

  const { error } = await supabase
    .from('friendships')
    .insert({
      requester_id: user.id,
      receiver_id: receiverId,
      status: 'pending',
    });

  if (error) throw error;
}