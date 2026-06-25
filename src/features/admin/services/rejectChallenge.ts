import { supabase } from '../../../database/supabase';
import { createNotification } from '../../notifications/services/createNotification';

export async function rejectChallenge(
  challengeId: string,
  reason: string,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('Admin não encontrado.');
  }

  const { data: challenge, error: challengeError } = await supabase
    .from('challenge_entries')
    .select('id, user_id')
    .eq('id', challengeId)
    .single();

  if (challengeError) {
    throw challengeError;
  }

  if (!challenge?.user_id) {
    throw new Error('Usuário do desafio não encontrado.');
  }

  const { error: updateError } = await supabase
    .from('challenge_entries')
    .update({
      status: 'disqualified',
      review_notes: reason,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      disqualified: true,
    })
    .eq('id', challengeId);

  if (updateError) {
    throw updateError;
  }

  const { error: proofsError } = await supabase
    .from('challenge_proofs')
    .update({
      status: 'rejected',
      admin_notes: reason,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('challenge_id', challengeId);

  if (proofsError) {
    throw proofsError;
  }

  await createNotification(
    challenge.user_id,
    'Comprovante reprovado',
    reason || 'Seu comprovante não foi aprovado pela administração.',
    'challenge_rejected',
    challengeId,
  );

  return true;
}
