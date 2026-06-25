import { supabase } from '../../../database/supabase';
import { grantBadge } from './grantBadge';

export async function evaluateUserBadges(userId: string) {
  const earnedBadges: string[] = [];

  const { count: completedChallenges } = await supabase
    .from('challenge_entries')
    .select('*', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', userId)
    .eq('status', 'completed');

  if ((completedChallenges ?? 0) >= 1) {
    await grantBadge(userId, 'first_challenge');
    earnedBadges.push('first_challenge');
  }

  const { count: medalsCount } = await supabase
    .from('medals')
    .select('*', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', userId);

  if ((medalsCount ?? 0) >= 1) {
    await grantBadge(userId, 'first_medal');
    earnedBadges.push('first_medal');
  }

  const { count: goldMedalsCount } = await supabase
    .from('medals')
    .select('*', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', userId)
    .eq('medal_type', 'gold');

  if ((goldMedalsCount ?? 0) >= 1) {
    await grantBadge(userId, 'gold_winner');
    earnedBadges.push('gold_winner');
  }

  const { count: trophiesCount } = await supabase
    .from('trophies')
    .select('*', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', userId);

  if ((trophiesCount ?? 0) >= 1) {
    await grantBadge(userId, 'recordist');
    earnedBadges.push('recordist');
  }

  const { data: streak } = await supabase
    .from('user_streaks')
    .select('current_streak, longest_streak')
    .eq('user_id', userId)
    .maybeSingle();

  const bestStreak = Math.max(
    Number(streak?.current_streak ?? 0),
    Number(streak?.longest_streak ?? 0),
  );

  if (bestStreak >= 7) {
    await grantBadge(userId, 'streak_7');
    earnedBadges.push('streak_7');
  }

  const { data: level } = await supabase
    .from('user_levels')
    .select('total_xp')
    .eq('user_id', userId)
    .maybeSingle();

  if (Number(level?.total_xp ?? 0) >= 5000) {
    await grantBadge(userId, 'elite_driver');
    earnedBadges.push('elite_driver');
  }

  return earnedBadges;
}
