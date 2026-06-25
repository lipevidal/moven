import { supabase } from '../../../database/supabase';
import { addXp } from './addXp';

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getYesterdayDateKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return getLocalDateKey(yesterday);
}

function getXpRewardForStreak(streak: number) {
  if (streak === 3) return 30;
  if (streak === 7) return 100;
  if (streak === 15) return 250;
  if (streak === 30) return 600;

  return 0;
}

export async function updateChallengeStreak(
  userId: string,
  challengeEntryId?: string,
) {
  const today = getLocalDateKey();
  const yesterday = getYesterdayDateKey();

  const { data: current, error: currentError } = await supabase
    .from('user_streaks')
    .select(
      'user_id, current_streak, longest_streak, last_completed_date',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (current?.last_completed_date === today) {
    return current;
  }

  const currentStreak =
    current?.last_completed_date === yesterday
      ? Number(current.current_streak ?? 0) + 1
      : 1;

  const longestStreak = Math.max(
    currentStreak,
    Number(current?.longest_streak ?? 0),
  );

  const { data, error } = await supabase
    .from('user_streaks')
    .upsert({
      user_id: userId,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_completed_date: today,
      updated_at: new Date().toISOString(),
    })
    .select(
      'user_id, current_streak, longest_streak, last_completed_date, updated_at',
    )
    .single();

  if (error) {
    throw error;
  }

  await supabase.from('streak_history').insert({
    user_id: userId,
    challenge_entry_id: challengeEntryId ?? null,
    streak_count: currentStreak,
    completed_date: today,
  });

  const xpReward = getXpRewardForStreak(currentStreak);

  if (xpReward > 0) {
    await addXp(
      userId,
      xpReward,
      `${currentStreak} dias de sequência em desafios`,
    );
  }

  return data;
}
