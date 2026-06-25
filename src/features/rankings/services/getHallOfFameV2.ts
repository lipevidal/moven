import { supabase } from '../../../database/supabase';

type GetHallOfFameParams = {
  challengeType: 'day' | 'week' | 'month';
  vehicleType: 'carro' | 'moto';
  scope: 'regional' | 'nacional';
  region?: string;
};

export async function getHallOfFameV2({
  challengeType,
  vehicleType,
  scope,
  region,
}: GetHallOfFameParams) {
  let query = supabase
    .from('challenge_entries')
    .select(
      `
      id,
      user_id,
      challenge_type,
      vehicle_type,
      region,
      approved_amount,
      medal,
      position,
      created_at
      `,
    )
    .eq('status', 'completed')
    .eq('challenge_type', challengeType)
    .eq('vehicle_type', vehicleType)
    .gt('approved_amount', 0);

  if (scope === 'regional' && region) {
    query = query.eq('region', region);
  }

  const { data: entries, error } = await query
    .order('approved_amount', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    throw error;
  }

  const userIds = [
    ...new Set(
      (entries ?? [])
        .map((item) => item.user_id)
        .filter(Boolean),
    ),
  ];

  if (!userIds.length) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, full_name, username, avatar_url')
    .in('id', userIds);

  if (profilesError) {
    throw profilesError;
  }

  return (entries ?? []).map((entry, index) => ({
    ...entry,
    record_position: index + 1,
    user:
      profiles?.find((profile) => profile.id === entry.user_id) ??
      null,
  }));
}
