import { supabase } from '../../../database/supabase';

export async function getMyChallenges(status?: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return [];
  }

  let query = supabase
    .from('challenge_entries')
    .select(
      `
      id,
      challenge_id,
      user_id,
      vehicle_type,
      region,
      ranking_type,
      ranking_types,
      platforms,
      status,
      challenge_type,
      approved_amount,
      submitted_amount,
      reported_amount,
      position,
      medal,
      proof_deadline,
      selected_days,
      selected_weeks,
      selected_months,
      reviewed_at,
      review_notes,
      created_at
      `,
    )
    .eq('user_id', user.id);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('created_at', {
    ascending: false,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}
