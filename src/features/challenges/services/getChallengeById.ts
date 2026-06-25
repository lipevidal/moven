import { supabase } from '../../../database/supabase';

export async function getChallengeById(id: string) {
  const { data, error } = await supabase
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
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
