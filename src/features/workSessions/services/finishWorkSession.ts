import { supabase } from '../../../database/supabase';

type FinishWorkSessionParams = {
  session_id: string;
  end_km: number;
  finished_at?: string;
};

function formatLocalDateTimeForSupabase(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  // Não use toISOString() aqui.
  // toISOString() converte para UTC.
  // Exemplo no Brasil: 10:40 vira 13:40 no banco se a coluna não tratar timezone.
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export async function finishWorkSession({
  session_id,
  end_km,
  finished_at,
}: FinishWorkSessionParams) {
  const finishDate = finished_at ? new Date(finished_at) : new Date();

  const { data: session, error: sessionError } = await supabase
    .from('work_sessions')
    .select(
      `
      id,
      vehicle_id,
      start_km,
      started_at,
      status,
      paused_at,
      total_paused_seconds
      `,
    )
    .eq('id', session_id)
    .single();

  if (sessionError) {
    throw sessionError;
  }

  const startedAt = new Date(session.started_at);

  if (finishDate.getTime() < startedAt.getTime()) {
    throw new Error(
      'O horário de finalização não pode ser antes do início da jornada.',
    );
  }

  if (Number(end_km) < Number(session.start_km ?? 0)) {
    throw new Error('O KM final não pode ser menor que o KM inicial.');
  }

  const basePausedSeconds = Number(session.total_paused_seconds ?? 0);

  let currentPauseSeconds = 0;

  if (session.status === 'paused' && session.paused_at) {
    const pausedAt = new Date(session.paused_at);

    if (finishDate.getTime() > pausedAt.getTime()) {
      currentPauseSeconds = Math.floor(
        (finishDate.getTime() - pausedAt.getTime()) / 1000,
      );
    }
  }

  const totalPausedSeconds = basePausedSeconds + currentPauseSeconds;

  // Finaliza a jornada.
  // Não atualizamos total_earnings aqui porque a tabela work_sessions
  // não possui essa coluna. Os ganhos continuam sendo salvos na tabela earnings.
  const { data, error } = await supabase
    .from('work_sessions')
    .update({
      status: 'finished',
      end_km,
      finished_at: formatLocalDateTimeForSupabase(finishDate),
      total_paused_seconds: totalPausedSeconds,
      paused_at: null,
    })
    .eq('id', session_id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  // Atualiza o KM atual do veículo para o mesmo KM final da jornada.
  // Assim, ao iniciar o próximo turno, o carro já estará com o KM correto.
  if (session.vehicle_id) {
    const { error: vehicleError } = await supabase
      .from('vehicles')
      .update({
        current_km: end_km,
      })
      .eq('id', session.vehicle_id);

    if (vehicleError) {
      throw vehicleError;
    }
  }

  return data;
}
