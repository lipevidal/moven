import { supabase } from '../../../database/supabase';

type PeriodType = 'day' | 'week' | 'month' | 'year';

type PeriodRecord = {
  key: string;
  label: string;
  amount: number;
  start: string;
  end: string;
};

type JourneyRecord = {
  id: string;
  amount: number;
  started_at: string | null;
  ended_at: string | null;
  total_hours: number;
  total_km: number;
  revenue_per_hour: number;
  revenue_per_km: number;
};

export async function getMyRecords() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return {
      journeyRevenue: null,
      day: null,
      week: null,
      month: null,
      year: null,
      bestPerHour: null,
      bestPerKm: null,
    };
  }

  const { data: earnings, error: earningsError } = await supabase
    .from('earnings')
    .select('amount, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (earningsError) {
    throw earningsError;
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'finished')
    .order('started_at', { ascending: false });

  if (sessionsError) {
    throw sessionsError;
  }

  const journeys = (sessions ?? []).map(normalizeJourney);

  const journeyRevenue = getBestJourneyRevenue(journeys);
  const bestPerHour = getBestPerHour(journeys);
  const bestPerKm = getBestPerKm(journeys);

  return {
    journeyRevenue,
    day: getBestPeriodRecord(earnings ?? [], 'day'),
    week: getBestPeriodRecord(earnings ?? [], 'week'),
    month: getBestPeriodRecord(earnings ?? [], 'month'),
    year: getBestPeriodRecord(earnings ?? [], 'year'),
    bestPerHour,
    bestPerKm,
  };
}

function normalizeJourney(item: any): JourneyRecord {
  const amount = Number(
    item.total_earnings ??
      item.total_revenue ??
      item.revenue ??
      item.amount ??
      0,
  );

  const totalHours = Number(
    item.total_hours ??
      item.duration_hours ??
      item.hours ??
      0,
  );

  const totalKm = Number(
    item.total_km ??
      item.km ??
      item.distance_km ??
      0,
  );

  return {
    id: item.id,
    amount,
    started_at: item.started_at ?? item.created_at ?? null,
    ended_at: item.ended_at ?? item.finished_at ?? null,
    total_hours: totalHours,
    total_km: totalKm,
    revenue_per_hour: totalHours > 0 ? amount / totalHours : 0,
    revenue_per_km: totalKm > 0 ? amount / totalKm : 0,
  };
}

function getBestJourneyRevenue(journeys: JourneyRecord[]) {
  return [...journeys].sort((a, b) => b.amount - a.amount)[0] ?? null;
}

function getBestPerHour(journeys: JourneyRecord[]) {
  return [...journeys]
    .filter((item) => item.revenue_per_hour > 0)
    .sort((a, b) => b.revenue_per_hour - a.revenue_per_hour)[0] ?? null;
}

function getBestPerKm(journeys: JourneyRecord[]) {
  return [...journeys]
    .filter((item) => item.revenue_per_km > 0)
    .sort((a, b) => b.revenue_per_km - a.revenue_per_km)[0] ?? null;
}

function getBestPeriodRecord(
  earnings: any[],
  periodType: PeriodType,
): PeriodRecord | null {
  const map = new Map<string, PeriodRecord>();

  for (const earning of earnings) {
    const date = new Date(earning.created_at);
    const period = getPeriodInfo(date, periodType);
    const current = map.get(period.key);

    if (current) {
      current.amount += Number(earning.amount ?? 0);
    } else {
      map.set(period.key, {
        key: period.key,
        label: period.label,
        amount: Number(earning.amount ?? 0),
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      });
    }
  }

  return [...map.values()].sort((a, b) => b.amount - a.amount)[0] ?? null;
}

function getPeriodInfo(date: Date, periodType: PeriodType) {
  if (periodType === 'day') {
    const start = startOfDay(date);
    const end = endOfDay(date);

    return {
      key: formatDateKey(start),
      label: start.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      start,
      end,
    };
  }

  if (periodType === 'week') {
    const start = startOfWeekMonday(date);
    const end = endOfDay(addDays(start, 6));

    return {
      key: formatDateKey(start),
      label: `${start.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      })} - ${end.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}`,
      start,
      end,
    };
  }

  if (periodType === 'month') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: start.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
      start,
      end,
    };
  }

  const start = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);

  return {
    key: String(start.getFullYear()),
    label: String(start.getFullYear()),
    start,
    end,
  };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = startOfDay(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
