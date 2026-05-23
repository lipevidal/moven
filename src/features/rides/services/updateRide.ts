import { supabase } from '../../../database/supabase';

type UpdateRideParams = {
  ride_id: string;
  platform: string;
  amount: number;
  start_km?: number | null;
};

export async function updateRide({
  ride_id,
  platform,
  amount,
  start_km,
}: UpdateRideParams) {
  const { data, error } = await supabase
    .from('rides')
    .update({
      platform,
      amount,
      start_km,
    })
    .eq('id', ride_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}