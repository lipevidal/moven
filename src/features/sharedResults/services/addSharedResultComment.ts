import { supabase } from '../../../database/supabase';

export async function addSharedResultComment(
  sharedResultId: string,
  comment: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuário não encontrado.');

  const { error } = await supabase
    .from('shared_result_comments')
    .insert({
      shared_result_id: sharedResultId,
      user_id: user.id,
      comment: comment.trim(),
    });

  if (error) throw error;
}