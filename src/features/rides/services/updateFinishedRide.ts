import { supabase } from '../../../database/supabase';

type Params = {
  ride_id: string;
  session_id: string;
  platform: string;
  old_amount: number;
  new_amount: number;
};

export async function updateFinishedRide({
  ride_id,
  session_id,
  platform,
  old_amount,
  new_amount,
}: Params) {
  const difference = new_amount - old_amount;

  const { data: ride, error: rideFindError } = await supabase
    .from('rides')
    .select('*')
    .eq('id', ride_id)
    .single();

  if (rideFindError) throw rideFindError;

  const startedAt = new Date(ride.started_at).getTime();
  const finishedAt = new Date(ride.finished_at).getTime();

  const durationHours = (finishedAt - startedAt) / (1000 * 60 * 60);
  const kmDriven = Number(ride.end_km ?? 0) - Number(ride.start_km ?? 0);

  const gainPerHour = durationHours > 0 ? new_amount / durationHours : 0;
  const gainPerKm = kmDriven > 0 ? new_amount / kmDriven : 0;

  const { data: earning } = await supabase
    .from('earnings')
    .select('*')
    .eq('session_id', session_id)
    .eq('platform', platform)
    .maybeSingle();

  if (earning) {
    await supabase
      .from('earnings')
      .update({
        amount: Number(earning.amount) + difference,
      })
      .eq('id', earning.id);
  }

  const { data, error } = await supabase
    .from('rides')
    .update({
      amount: new_amount,
      gain_per_hour: gainPerHour,
      gain_per_km: gainPerKm,
    })
    .eq('id', ride_id)
    .select()
    .single();

  if (error) throw error;

  return data;
}