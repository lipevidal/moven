import { supabase } from '../../../database/supabase';

export async function getProfileChallengeStats(userId: string) {
  const { data, error } = await supabase
    .from('challenge_entries')
    .select('id, status, approved_amount, position')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  const entries = data ?? [];

  const completed = entries.filter((item) => item.status === 'completed');

  const participations = entries.length;

  const podiums = completed.filter(
    (item) => Number(item.position ?? 0) >= 1 && Number(item.position ?? 0) <= 3,
  ).length;

  const bestPosition = completed.reduce<number | null>((best, item) => {
    const position = Number(item.position ?? 0);

    if (!position) return best;

    if (best === null) return position;

    return position < best ? position : best;
  }, null);

  const totalApprovedAmount = completed.reduce((total, item) => {
    return total + Number(item.approved_amount ?? 0);
  }, 0);

  const biggestEarning = completed.reduce((biggest, item) => {
    const amount = Number(item.approved_amount ?? 0);

    return amount > biggest ? amount : biggest;
  }, 0);

  return {
    participations,
    completed: completed.length,
    podiums,
    best_position: bestPosition,
    total_approved_amount: totalApprovedAmount,
    biggest_earning: biggestEarning,
  };
}
