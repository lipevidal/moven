import { supabase } from '../../../database/supabase';

export async function getUserAchievementRewards(userId?: string) {
  let targetUserId = userId;

  if (!targetUserId) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    targetUserId = user?.id;
  }

  if (!targetUserId) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_achievements')
    .select(
      `
      id,
      achievement_key,
      reward_kind,
      reward_label,
      reward_xp,
      earned_at,
      achievement_definitions (
        title,
        description,
        icon
      )
      `,
    )
    .eq('user_id', targetUserId)
    .order('earned_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}
