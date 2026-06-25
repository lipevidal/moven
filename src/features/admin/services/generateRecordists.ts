import { supabase } from '../../../database/supabase';

export async function generateRecordists(
  challengeType: string,
  vehicleType: string,
) {
  const { data, error } =
    await supabase
      .from('challenge_entries')
      .select('*')
      .eq('status', 'completed')
      .eq('challenge_type', challengeType)
      .eq('vehicle_type', vehicleType)
      .order(
        'approved_amount',
        {
          ascending: false,
        },
      )
      .limit(3);

  if (error) throw error;

  return data ?? [];
}