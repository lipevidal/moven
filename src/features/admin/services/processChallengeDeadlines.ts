import { supabase } from '../../../database/supabase';

export async function processChallengeDeadlines() {
  const { data, error } = await supabase
    .rpc('process_challenge_deadlines');

  if (error) {
    throw error;
  }

  return data ?? [];
}
