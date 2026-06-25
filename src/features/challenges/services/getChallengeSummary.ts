import { supabase } from '../../../database/supabase';

export async function getChallengeSummary() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return {
      total: 0,
      active: null,
      waitingProof: 0,
      underReview: 0,
      completed: 0,
    };
  }

  const { data, error } = await supabase
    .from('challenge_entries')
    .select(
      `
      id,
      challenge_type,
      vehicle_type,
      region,
      status,
      approved_amount,
      submitted_amount,
      position,
      medal,
      created_at
      `,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const entries = data ?? [];

  const active =
    entries.find((item) =>
      ['waiting_proof', 'under_review', 'ongoing'].includes(
        item.status,
      ),
    ) ?? null;

  return {
    total: entries.length,
    active,
    waitingProof: entries.filter(
      (item) => item.status === 'waiting_proof',
    ).length,
    underReview: entries.filter(
      (item) => item.status === 'under_review',
    ).length,
    completed: entries.filter(
      (item) => item.status === 'completed',
    ).length,
  };
}
