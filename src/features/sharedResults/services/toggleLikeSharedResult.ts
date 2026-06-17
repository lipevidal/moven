import { supabase } from '../../../database/supabase';

export async function toggleLikeSharedResult(sharedResultId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuário não encontrado.');

  const { data: existing } = await supabase
    .from('shared_result_likes')
    .select('id')
    .eq('shared_result_id', sharedResultId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('shared_result_likes')
      .delete()
      .eq('id', existing.id);

    if (error) throw error;

    return false;
  }

  const { error } = await supabase
    .from('shared_result_likes')
    .insert({
      shared_result_id: sharedResultId,
      user_id: user.id,
    });

  if (error) throw error;

  return true;
}