import { supabase } from '../../../database/supabase';
import { createNotification } from '../../notifications/services/createNotification';
import { addXp } from '../../gamification/services/addXp';
import { updateChallengeStreak } from '../../gamification/services/updateChallengeStreak';
import { evaluateUserBadges } from '../../gamification/services/evaluateUserBadges';

export async function approveChallenge(
  challengeId: string,
  approvedAmount: number,
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
    .select('id, user_id, status')
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
      status: 'completed',
      approved_amount: approvedAmount,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: null,
      disqualified: false,
    })
    .eq('id', challengeId);

  if (updateError) {
    throw updateError;
  }

  const { error: proofsError } = await supabase
    .from('challenge_proofs')
    .update({
      status: 'approved',
      approved_amount: approvedAmount,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('challenge_id', challengeId);

  if (proofsError) {
    throw proofsError;
  }

  await addXp(
    challenge.user_id,
    20,
    'Comprovante aprovado',
  );

  await updateChallengeStreak(
    challenge.user_id,
    challengeId,
  );

  await evaluateUserBadges(
    challenge.user_id,
  );

  await createNotification(
    challenge.user_id,
    'Comprovante aprovado',
    'Seu comprovante foi aprovado e seu resultado entrará no ranking.',
    'challenge_approved',
    challengeId,
  );

  return true;
}
