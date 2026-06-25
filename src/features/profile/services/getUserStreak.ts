import { supabase } from '../../../database/supabase';

export async function getUserStreak(userId: string) {
  const { data, error } = await supabase
    .from('user_streaks')
    .select(
      'user_id, current_streak, longest_streak, last_completed_date, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      user_id: userId,
      current_streak: 0,
      longest_streak: 0,
      last_completed_date: null,
      updated_at: null,
    };
  }

  return data;
}
