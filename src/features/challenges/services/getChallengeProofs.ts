import { supabase } from '../../../database/supabase';

export async function getChallengeProofs(challengeId: string) {
  const { data, error } = await supabase
    .from('challenge_proofs')
    .select(
      `
      id,
      challenge_id,
      user_id,
      image_url,
      declared_amount,
      approved_amount,
      status,
      admin_notes,
      reviewed_at,
      created_at
      `,
    )
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}
