import { supabase } from '../../../database/supabase';

type StartWaitingRideParams = {
  ride_id: string;
  start_km: number;
};

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, -1);
}

export async function startWaitingRide({
  ride_id,
  start_km,
}: StartWaitingRideParams) {
  const { data, error } = await supabase
    .from('rides')
    .update({
      status: 'active',
      start_km,
      started_at: toLocalISOString(new Date()),
    })
    .eq('id', ride_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}