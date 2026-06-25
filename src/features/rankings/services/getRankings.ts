import { supabase } from '../../../database/supabase';

export async function getRankings(
  challengeType: string,
  vehicleType: string,
  rankingType: string,
  region?: string,
) {
  let query = supabase
    .from('ranking_view')
    .select('*')
    .eq(
      'challenge_type',
      challengeType,
    )
    .eq(
      'vehicle_type',
      vehicleType,
    )
    .order('position');

  if (
    rankingType === 'regional' &&
    region
  ) {
    query = query.eq(
      'region',
      region,
    );
  }

  const { data, error } =
    await query;

  if (error) throw error;

  return data ?? [];
}