import { supabase } from '../../../database/supabase';

export async function getUserTrophies(
  userId: string,
) {
  const { data, error } =
    await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', userId);

  if (error) throw error;

  return data ?? [];
}