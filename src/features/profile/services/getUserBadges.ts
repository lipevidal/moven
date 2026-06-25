import { supabase } from '../../../database/supabase';

export async function getUserBadges(userId: string) {
  const { data, error } = await supabase
    .from('user_badges')
    .select(
      `
      id,
      earned_at,
      badge:badges(
        id,
        slug,
        title,
        description,
        icon,
        xp_reward
      )
    `,
    )
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}
