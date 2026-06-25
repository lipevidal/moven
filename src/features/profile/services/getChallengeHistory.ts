import { supabase } from '../../../database/supabase';

export async function getChallengeHistory(userId: string) {
  const { data, error } = await supabase
    .from('challenge_entries')
    .select(
      'id, user_id, challenge_type, vehicle_type, region, approved_amount, position, medal, status, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', {
      ascending: false,
    })
    .limit(10);

  if (error) {
    throw error;
  }

  return data ?? [];
}
