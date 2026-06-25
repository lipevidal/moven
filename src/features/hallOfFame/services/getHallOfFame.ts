import { supabase } from '../../../database/supabase';

export async function getHallOfFame(
  challengeType: string,
  vehicleType: string,
) {
  const { data: entries, error } = await supabase
    .from('challenge_entries')
    .select('id, user_id, challenge_type, vehicle_type, region, approved_amount, position, medal, created_at')
    .eq('status', 'completed')
    .eq('challenge_type', challengeType)
    .eq('vehicle_type', vehicleType)
    .order('approved_amount', {
      ascending: false,
    })
    .limit(20);

  if (error) {
    throw error;
  }

  const rankingEntries = entries ?? [];

  if (!rankingEntries.length) {
    return [];
  }

  const userIds = [
    ...new Set(
      rankingEntries
        .map((item) => item.user_id)
        .filter(Boolean),
    ),
  ];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, full_name, avatar_url, username')
    .in('id', userIds);

  if (profilesError) {
    throw profilesError;
  }

  return rankingEntries.map((entry, index) => {
    const profile = profiles?.find((item) => item.id === entry.user_id);

    return {
      ...entry,
      hall_position: index + 1,
      user: profile ?? null,
    };
  });
}
