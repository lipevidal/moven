import { supabase } from '../../../database/supabase';

export type DayWorkSession = {
  id: string;
  started_at: string;
  finished_at: string | null;
  start_km: number | null;
  end_km: number | null;
  total_paused_seconds: number | null;
  vehicle?: {
    model?: string | null;
    plate?: string | null;
  } | null;
  earnings: Array<{
    id: string;
    platform: string;
    amount: number;
    earning_date?: string | null;
    created_at?: string | null;
  }>;
  rides: Array<{
    id: string;
    platform: string | null;
    amount: number | null;
    started_at: string | null;
    finished_at: string | null;
    start_km: number | null;
    end_km: number | null;
    status: string | null;
  }>;
  totalEarnings: number;
  totalKm: number;
  totalHours: number;
  revenuePerHour: number;
  revenuePerKm: number;
};

function getLocalDateKey(value: Date | string | null | undefined) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getWideSearchRange(referenceDate: Date) {
  /*
    Buscamos uma janela maior no banco e filtramos o dia certo localmente.
    Isso evita que timestamp/timestamptz, UTC, São Paulo e string sem timezone
    façam a jornada sumir da lista.
  */
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);

  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function calculateHours(session: any) {
  if (!session.started_at || !session.finished_at) return 0;

  const start = new Date(session.started_at).getTime();
  const finish = new Date(session.finished_at).getTime();
  const pausedSeconds = Number(session.total_paused_seconds ?? 0);

  if (Number.isNaN(start) || Number.isNaN(finish) || finish <= start) {
    return 0;
  }

  const totalSeconds = Math.max(
    Math.floor((finish - start) / 1000) - pausedSeconds,
    0,
  );

  return totalSeconds / 3600;
}

export async function getDayWorkSessions(
  referenceDate: Date,
): Promise<DayWorkSession[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user?.id) {
    return [];
  }

  const targetDateKey = getLocalDateKey(referenceDate);
  const { start, end } = getWideSearchRange(referenceDate);

  /*
    REGRA DEFINITIVA:
    A jornada pertence exclusivamente ao dia em que começou.

    Aqui NÃO decidimos o dia pelo finished_at.
    O banco busca uma janela maior, e o filtro final é feito localmente
    comparando o dia local de started_at com o dia selecionado.
  */
  const { data, error } = await supabase
    .from('work_sessions')
    .select(
      `
      id,
      started_at,
      finished_at,
      start_km,
      end_km,
      total_paused_seconds,
      vehicle:vehicles(model, plate),
      earnings(id, platform, amount, earning_date, created_at),
      rides(id, platform, amount, started_at, finished_at, start_km, end_km, status)
      `,
    )
    .eq('user_id', user.id)
    .gte('started_at', start)
    .lte('started_at', end)
    .order('started_at', { ascending: true });

  if (error) {
    throw error;
  }

  const sessionsFromSelectedDay = (data ?? []).filter((session: any) => {
    const sessionDateKey = getLocalDateKey(session.started_at);
    const isSelectedDay = sessionDateKey === targetDateKey;

    /*
      Mantém a tela mostrando jornadas finalizadas,
      mas evita sumir caso o status venha nulo/maiúsculo por algum registro antigo.
    */
    const status = String(session.status ?? '').toLowerCase();
    const isFinished = !status || status === 'finished';

    return isSelectedDay && isFinished;
  });

  return sessionsFromSelectedDay.map((session: any) => {
    const earnings = (session.earnings ?? []).map((earning: any) => ({
      ...earning,

      /*
        Mesmo que o earning_date original esteja no dia seguinte,
        visualmente o ganho do turno pertence ao started_at da jornada.
      */
      earning_date: session.started_at,
    }));

    const rides = session.rides ?? [];

    const totalEarnings = earnings.reduce(
      (total: number, item: any) => total + Number(item.amount ?? 0),
      0,
    );

    const totalKm = Math.max(
      Number(session.end_km ?? 0) - Number(session.start_km ?? 0),
      0,
    );

    const totalHours = calculateHours(session);

    return {
      ...session,
      earnings,
      rides,
      totalEarnings,
      totalKm,
      totalHours,
      revenuePerHour: totalHours > 0 ? totalEarnings / totalHours : 0,
      revenuePerKm: totalKm > 0 ? totalEarnings / totalKm : 0,
    };
  });
}
