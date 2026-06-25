import { supabase } from '../../../database/supabase';

export type RankingPeriod = 'day' | 'week' | 'month';
export type RankingVehicle = 'carro' | 'moto';
export type RankingScope = 'regional' | 'nacional' | 'recordists';

type GetPublicRankingsParams = {
  period: RankingPeriod;
  vehicleType: RankingVehicle;
  scope: RankingScope;
  region?: string;
};

export async function getPublicRankings({
  period,
  vehicleType,
  scope,
  region,
}: GetPublicRankingsParams) {
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
      position,
      medal,
      created_at,
      status
      `,
    )
    .eq('status', 'completed')
    .eq('challenge_type', period)
    .eq('vehicle_type', vehicleType);

  if (scope === 'regional' && region) {
    query = query.eq('region', region);
  }

  const limit = scope === 'recordists' ? 20 : 50;

  const { data: entries, error } = await query
    .order('approved_amount', { ascending: false })
    .limit(limit);

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

  return (entries ?? []).map((item, index) => {
    const user = profiles?.find(
      (profile) => profile.id === item.user_id,
    );

    return {
      ...item,
      position: item.position ?? index + 1,
      hall_position: index + 1,
      user: user ?? null,
    };
  });
}
