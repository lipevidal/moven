import { supabase } from '../../../database/supabase';

export async function generateRanking(
  challengeType: string,
  vehicleType: string,
  region?: string,
) {
  let query = supabase
    .from('challenge_entries')
    .select('*')
    .eq('status', 'completed')
    .eq('challenge_type', challengeType)
    .eq('vehicle_type', vehicleType);

  if (region) {
    query = query.eq('region', region);
  }

  const { data, error } =
    await query.order(
      'approved_amount',
      {
        ascending: false,
      },
    );

  if (error) throw error;

  if (!data?.length) return [];

  for (
    let i = 0;
    i < data.length;
    i++
  ) {
    await supabase
      .from('challenge_entries')
      .update({
        position: i + 1,
      })
      .eq('id', data[i].id);
  }

  return data;
}