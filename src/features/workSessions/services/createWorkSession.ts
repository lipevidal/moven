import { supabase } from '../../../database/supabase';

type CreateWorkSessionParams = {
  vehicle_id: string;

  start_km: number;

  started_at?: Date;
};

export async function createWorkSession({
  vehicle_id,
  start_km,
  started_at,
}: CreateWorkSessionParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data: activeSession } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (activeSession) {
    throw new Error(
      'Você já possui uma jornada ativa.',
    );
  }

  const { data, error } = await supabase
    .from('work_sessions')
    .insert({
      user_id: user.id,

      vehicle_id,

      start_km,

      started_at:
        started_at?.toISOString() ??
        new Date().toISOString(),

      status: 'active',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}