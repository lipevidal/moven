import { supabase } from '../../../database/supabase';

type FinishRideParams = {
  ride_id: string;
  session_id: string;
  vehicle_id: string;
  platform: string;
  amount: number;
  start_km: number;
  end_km: number;
  started_at: string;
};

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, -1);
}

export async function finishRide({
  ride_id,
  session_id,
  vehicle_id,
  platform,
  amount,
  start_km,
  end_km,
  started_at,
}: FinishRideParams) {
  const finishedAt = new Date();

  const startedAtDate = new Date(started_at);

  const durationHours =
    (finishedAt.getTime() - startedAtDate.getTime()) /
    (1000 * 60 * 60);

  const kmDriven = end_km - start_km;

  const gainPerHour =
    durationHours > 0 ? amount / durationHours : 0;

  const gainPerKm =
    kmDriven > 0 ? amount / kmDriven : 0;

  const { error: finishError } = await supabase
    .from('rides')
    .update({
      status: 'finished',
      end_km,
      amount,
      finished_at: toLocalISOString(finishedAt),
      gain_per_hour: gainPerHour,
      gain_per_km: gainPerKm,
    })
    .eq('id', ride_id);

  if (finishError) {
    throw finishError;
  }

  const { data: existingEarning } = await supabase
    .from('earnings')
    .select('*')
    .eq('session_id', session_id)
    .eq('platform', platform)
    .maybeSingle();

  if (existingEarning) {
    await supabase
      .from('earnings')
      .update({
        amount: Number(existingEarning.amount) + amount,
      })
      .eq('id', existingEarning.id);
  } else {
    await supabase
      .from('earnings')
      .insert({
        session_id,
        platform,
        category: platform,
        amount,
      });
  }

  await supabase
    .from('work_sessions')
    .update({
      end_km,
    })
    .eq('id', session_id);

  await supabase
    .from('vehicles')
    .update({
      current_km: end_km,
    })
    .eq('id', vehicle_id);

  const { data: nextRide } = await supabase
    .from('rides')
    .select('*')
    .eq('session_id', session_id)
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextRide) {
    await supabase
      .from('rides')
      .update({
        status: 'active',
        start_km: end_km,
        started_at: toLocalISOString(new Date()),
      })
      .eq('id', nextRide.id);
  }

  return {
    amount,
    gain_per_hour: gainPerHour,
    gain_per_km: gainPerKm,
    km_driven: kmDriven,
  };
}