import { supabase } from '../../../database/supabase';

type CreateWorkSessionParams = {
  vehicle_id: string;
  start_km: number;
  started_at?: Date;
};

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, -1);
}

export async function createWorkSession({
  vehicle_id,
  start_km,
  started_at,
}: CreateWorkSessionParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuário não autenticado.');
  }

  const { data, error } = await supabase
    .from('work_sessions')
    .insert({
      user_id: user.id,
      vehicle_id,
      start_km,
      status: 'active',
      started_at: started_at
        ? toLocalISOString(started_at)
        : toLocalISOString(new Date()),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}