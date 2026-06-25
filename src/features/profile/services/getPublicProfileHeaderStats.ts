import { supabase } from '../../../database/supabase';

const rewardPriority = [
  { kind: 'diamond', icon: '💎', priority: 4 },
  { kind: 'trophy', icon: '🏆', priority: 3 },
  { kind: 'medal_gold', icon: '🥇', priority: 2 },
  { kind: 'medal_silver', icon: '🥈', priority: 1 },
];

export async function getPublicProfileHeaderStats(userId: string) {
  const { data: levels, error: levelsError } = await supabase
    .from('user_levels')
    .select('user_id, total_xp')
    .order('total_xp', { ascending: false });

  if (levelsError) {
    throw levelsError;
  }

  const nationalPosition =
    (levels ?? []).findIndex((item) => item.user_id === userId) + 1;

  const { data: achievements, error: achievementsError } = await supabase
    .from('user_achievements')
    .select('reward_kind')
    .eq('user_id', userId);

  if (achievementsError) {
    throw achievementsError;
  }

  const counts = new Map<string, number>();

  for (const item of achievements ?? []) {
    counts.set(
      item.reward_kind,
      (counts.get(item.reward_kind) ?? 0) + 1,
    );
  }

  const bestReward = rewardPriority.find((reward) =>
    counts.has(reward.kind),
  );

  return {
    nationalPosition: nationalPosition > 0 ? nationalPosition : null,
    bestRewardIcon: bestReward?.icon ?? null,
    bestRewardCount: bestReward ? counts.get(bestReward.kind) ?? 0 : 0,
    bestRewardKind: bestReward?.kind ?? null,
  };
}
