import { supabase } from '../../../database/supabase';

export async function getProfileStats(
  userId: string,
) {
  const { data, error } =
    await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .single();

  if (error) throw error;

  return data;
}