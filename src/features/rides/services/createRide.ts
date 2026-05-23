import { supabase } from '../../../database/supabase';

type CreateRideParams = {
  session_id: string;
  vehicle_id: string;
  platform: string;
  amount: number;
  start_km?: number;
  status: 'waiting' | 'active';
};

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, -1);
}

export async function createRide({
  session_id,
  vehicle_id,
  platform,
  amount,
  start_km,
  status,
}: CreateRideParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuário não autenticado.');
  }

  const isActive = status === 'active';

  const { data, error } = await supabase
    .from('rides')
    .insert({
      user_id: user.id,
      session_id,
      vehicle_id,
      platform,
      amount,
      status,
      start_km: isActive ? start_km : null,
      started_at: isActive ? toLocalISOString(new Date()) : null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}