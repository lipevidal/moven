import { supabase } from '../../../database/supabase';

export async function getLevel(userId: string) {
  const { data, error } = await supabase
    .from('user_levels')
    .select('user_id, level, xp, total_xp')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      user_id: userId,
      level: 1,
      xp: 0,
      total_xp: 0,
    };
  }

  return data;
}