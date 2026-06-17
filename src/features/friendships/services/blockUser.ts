import { supabase } from '../../../database/supabase';

export async function blockUser(blockedId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuário não encontrado.');

  await supabase
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${user.id},receiver_id.eq.${blockedId}),and(requester_id.eq.${blockedId},receiver_id.eq.${user.id})`,
    );

  const { error } = await supabase.from('user_blocks').upsert(
    {
      blocker_id: user.id,
      blocked_id: blockedId,
    },
    {
      onConflict: 'blocker_id,blocked_id',
    },
  );

  if (error) throw error;
}