import { supabase } from '../../../database/supabase';

export type UserLevelInfo = {
  level: number;
  xp: number;
  total_xp: number;
  xp_required: number;
  xp_to_next_level: number;
  progress_percent: number;
};

export async function getUserLevel(userId?: string): Promise<UserLevelInfo> {
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
    return buildLevelInfo(0);
  }

  const { data, error } = await supabase
    .from('user_levels')
    .select('level, xp, total_xp')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return buildLevelInfo(Number(data?.total_xp ?? 0));
}

export function buildLevelInfo(totalXp: number): UserLevelInfo {
  const safeTotalXp = Math.max(Number(totalXp ?? 0), 0);
  const level = Math.floor(safeTotalXp / 100) + 1;
  const xp = safeTotalXp % 100;
  const xpRequired = 100;
  const xpToNextLevel = xpRequired - xp;
  const progressPercent = Math.min((xp / xpRequired) * 100, 100);

  return {
    level,
    xp,
    total_xp: safeTotalXp,
    xp_required: xpRequired,
    xp_to_next_level: xpToNextLevel,
    progress_percent: progressPercent,
  };
}
