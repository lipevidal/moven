import { supabase } from '../../../database/supabase';

export async function getChallengeReview(challengeId: string) {
  const { data: challenge, error: challengeError } = await supabase
    .from('challenge_entries')
    .select(
      `
      id,
      user_id,
      vehicle_type,
      region,
      platforms,
      status,
      challenge_type,
      submitted_amount,
      reported_amount,
      approved_amount,
      position,
      medal,
      review_notes,
      created_at
      `,
    )
    .eq('id', challengeId)
    .single();

  if (challengeError) {
    throw challengeError;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, full_name, avatar_url, username')
    .eq('id', challenge.user_id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const { data: proofs, error: proofsError } = await supabase
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

  if (proofsError) {
    throw proofsError;
  }

  return {
    challenge: {
      ...challenge,
      user: profile ?? null,
    },
    proofs: proofs ?? [],
  };
}
