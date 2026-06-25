import { supabase } from '../../../database/supabase';

export async function addXp(
  userId: string,
  xpToAdd: number,
  reason: string,
) {
  const { data: currentLevelData, error: levelError } = await supabase
    .from('user_levels')
    .select('user_id, level, xp, total_xp')
    .eq('user_id', userId)
    .maybeSingle();

  if (levelError) {
    throw levelError;
  }

  let currentLevel = currentLevelData?.level ?? 1;
  let currentXp = currentLevelData?.xp ?? 0;
  let totalXp = currentLevelData?.total_xp ?? 0;

  currentXp += xpToAdd;
  totalXp += xpToAdd;

  while (currentXp >= currentLevel * 100) {
    currentXp -= currentLevel * 100;
    currentLevel++;
  }

  const { error: upsertError } = await supabase
    .from('user_levels')
    .upsert({
      user_id: userId,
      level: currentLevel,
      xp: currentXp,
      total_xp: totalXp,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) {
    throw upsertError;
  }

  const { error: historyError } = await supabase
    .from('xp_history')
    .insert({
      user_id: userId,
      xp: xpToAdd,
      reason,
    });

  if (historyError) {
    throw historyError;
  }

  return {
    level: currentLevel,
    xp: currentXp,
    total_xp: totalXp,
  };
}
