import { supabase } from '../../../database/supabase';

export async function getUserMedals(userId: string) {
  const { data, error } = await supabase
    .from('medals')
    .select('id, user_id, challenge_id, medal_type, created_at')
    .eq('user_id', userId)
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data ?? [];
}
