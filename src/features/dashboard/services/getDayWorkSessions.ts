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

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getDayRange(referenceDate: Date) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  return {
    start: formatLocalDateTime(start),
    end: formatLocalDateTime(end),
  };
}

function calculateHours(session: any) {
  if (!session.started_at || !session.finished_at) return 0;

  const start = new Date(session.started_at).getTime();
  const finish = new Date(session.finished_at).getTime();
  const pausedSeconds = Number(session.total_paused_seconds ?? 0);

  const totalSeconds = Math.max(
    Math.floor((finish - start) / 1000) - pausedSeconds,
    0,
  );

  return totalSeconds / 3600;
}

export async function getDayWorkSessions(referenceDate: Date): Promise<DayWorkSession[]> {
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

  const { start, end } = getDayRange(referenceDate);

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
      earnings(id, platform, amount),
      rides(id, platform, amount, started_at, finished_at, start_km, end_km, status)
      `,
    )
    .eq('user_id', user.id)
    .eq('status', 'finished')
    .gte('started_at', start)
    .lte('started_at', end)
    .order('started_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((session: any) => {
    const earnings = session.earnings ?? [];
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
