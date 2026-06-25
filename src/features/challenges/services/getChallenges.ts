import { supabase } from '../../../database/supabase';

export async function getChallenges() {
  const { data, error } = await supabase
    .from('challenges')
    .select(
      `
      id,
      challenge_type,
      start_date,
      end_date,
      status,
      created_at
      `,
    )
    .in('status', ['open', 'active'])
    .order('start_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}
