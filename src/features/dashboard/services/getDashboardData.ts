import { supabase } from '../../../database/supabase';

export type DashboardPeriod = 'day' | 'week' | 'month' | 'year';

type PeriodRange = {
  start: Date;
  end: Date;
};

type EarningItem = {
  id?: string;
  platform?: string | null;
  amount?: number | string | null;
  earning_date?: string | null;
  created_at?: string | null;
  session_id?: string | null;
};

type SessionItem = {
  id: string;
  started_at?: string | null;
  finished_at?: string | null;
  start_km?: number | string | null;
  end_km?: number | string | null;
  total_paused_seconds?: number | string | null;
  earnings?: EarningItem[] | null;
};

type ExpenseItem = {
  id?: string;
  amount?: number | string | null;
  expense_date?: string | null;
};

const shortWeekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const shortMonths = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Maio',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
}

function getWeekRange(baseDate: Date): PeriodRange {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getPeriodRange(
  period: DashboardPeriod = 'week',
  referenceDate: Date = new Date(),
): PeriodRange {
  const date = new Date(referenceDate);

  if (period === 'day') {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (period === 'week') {
    return getWeekRange(date);
  }

  if (period === 'month') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    return { start, end };
  }

  const start = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);

  return { start, end };
}

function getPreviousPeriodRange(period: DashboardPeriod, referenceDate: Date) {
  const previous = new Date(referenceDate);

  if (period === 'day') {
    previous.setDate(previous.getDate() - 1);
  }

  if (period === 'week') {
    previous.setDate(previous.getDate() - 7);
  }

  if (period === 'month') {
    previous.setMonth(previous.getMonth() - 1);
  }

  if (period === 'year') {
    previous.setFullYear(previous.getFullYear() - 1);
  }

  return getPeriodRange(period, previous);
}

function getSessionDate(session: SessionItem) {
  return session.finished_at ?? session.started_at ?? null;
}

function getSessionHours(session: SessionItem) {
  if (!session.started_at || !session.finished_at) return 0;

  const start = new Date(session.started_at).getTime();
  const end = new Date(session.finished_at).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;

  const pausedSeconds = Number(session.total_paused_seconds ?? 0);
  const seconds = Math.max((end - start) / 1000 - pausedSeconds, 0);

  return seconds / 3600;
}

function getSessionKm(session: SessionItem) {
  const startKm = Number(session.start_km ?? 0);
  const endKm = Number(session.end_km ?? session.start_km ?? 0);

  return Math.max(endKm - startKm, 0);
}

function getAmount(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0;
}

function sumEarnings(earnings: EarningItem[]) {
  return earnings.reduce((total, item) => total + getAmount(item.amount), 0);
}

function groupPlatformTotals(earnings: EarningItem[]) {
  return earnings.reduce<Record<string, number>>((acc, earning) => {
    const platform = earning.platform || 'Outros';
    acc[platform] = (acc[platform] ?? 0) + getAmount(earning.amount);

    return acc;
  }, {});
}

function getEarningDate(earning: EarningItem, fallbackDate?: string | null) {
  return earning.earning_date ?? earning.created_at ?? fallbackDate ?? null;
}

function samePeriodDay(date: Date, target: Date) {
  return (
    date.getDate() === target.getDate() &&
    date.getMonth() === target.getMonth() &&
    date.getFullYear() === target.getFullYear()
  );
}

function buildBarChartData(
  period: DashboardPeriod,
  referenceDate: Date,
  earnings: EarningItem[],
) {
  if (period === 'week') {
    const { start } = getWeekRange(referenceDate);

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      const value = earnings.reduce((total, earning) => {
        const earningDateValue = getEarningDate(earning);
        if (!earningDateValue) return total;

        const earningDate = new Date(earningDateValue);
        if (Number.isNaN(earningDate.getTime())) return total;

        return samePeriodDay(earningDate, date)
          ? total + getAmount(earning.amount)
          : total;
      }, 0);

      return {
        label: shortWeekDays[date.getDay()],
        date: date.toISOString(),
        value,
      };
    });
  }

  if (period === 'month') {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: lastDay }).map((_, index) => {
      const day = index + 1;
      const date = new Date(year, month, day, 12, 0, 0, 0);

      const value = earnings.reduce((total, earning) => {
        const earningDateValue = getEarningDate(earning);
        if (!earningDateValue) return total;

        const earningDate = new Date(earningDateValue);
        if (Number.isNaN(earningDate.getTime())) return total;

        return samePeriodDay(earningDate, date)
          ? total + getAmount(earning.amount)
          : total;
      }, 0);

      return {
        label: String(day),
        day,
        date: date.toISOString(),
        value,
      };
    });
  }

  if (period === 'year') {
    const year = referenceDate.getFullYear();

    return Array.from({ length: 12 }).map((_, month) => {
      const value = earnings.reduce((total, earning) => {
        const earningDateValue = getEarningDate(earning);
        if (!earningDateValue) return total;

        const earningDate = new Date(earningDateValue);
        if (Number.isNaN(earningDate.getTime())) return total;

        const sameMonth =
          earningDate.getFullYear() === year && earningDate.getMonth() === month;

        return sameMonth ? total + getAmount(earning.amount) : total;
      }, 0);

      return {
        label: shortMonths[month],
        value,
      };
    });
  }

  return [];
}

async function getStandaloneEarningsByPeriod(
  userId: string,
  start: Date,
  end: Date,
) {
  const { data, error } = await supabase
    .from('earnings')
    .select('id, user_id, session_id, platform, description, amount, earning_date, created_at')
    .eq('user_id', userId)
    .is('session_id', null)
    .gte('earning_date', toLocalISOString(start))
    .lte('earning_date', toLocalISOString(end))
    .order('earning_date', { ascending: false });

  if (error) {
    console.log('Erro ao buscar ganhos avulsos:', error);
    return [];
  }

  return data ?? [];
}

async function getRevenueByRange(userId: string, start: Date, end: Date) {
  const sessions = await getSessionsByPeriod(userId, start, end);
  const sessionEarnings = getSessionEarningsWithDate(sessions);

  const standaloneEarnings = await getStandaloneEarningsByPeriod(
    userId,
    start,
    end,
  );

  return sumEarnings([...sessionEarnings, ...standaloneEarnings]);
}

async function getSessionsByPeriod(userId: string, start: Date, end: Date) {
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
      status,
      earnings (
        id,
        platform,
        amount,
        created_at
      )
      `,
    )
    .eq('user_id', userId)
    .eq('status', 'finished')
    .gte('finished_at', toLocalISOString(start))
    .lte('finished_at', toLocalISOString(end))
    .order('finished_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SessionItem[];
}

function getSessionEarningsWithDate(sessions: SessionItem[]) {
  return sessions.flatMap((session) => {
    const fallbackDate = getSessionDate(session);

    return (session.earnings ?? []).map((earning) => ({
      ...earning,
      earning_date: getEarningDate(earning, fallbackDate),
      session_id: session.id,
    }));
  });
}

async function getExpensesByPeriod(userId: string, start: Date, end: Date) {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, amount, expense_date')
    .eq('user_id', userId)
    .gte('expense_date', toLocalISOString(start))
    .lte('expense_date', toLocalISOString(end));

  if (error) {
    throw error;
  }

  return (data ?? []) as ExpenseItem[];
}

export async function getDashboardData(
  period: DashboardPeriod = 'week',
  referenceDate: Date = new Date(),
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('Usuário não autenticado.');
  }

  const { start, end } = getPeriodRange(period, referenceDate);

  const [sessions, standaloneEarnings, expenses] = await Promise.all([
    getSessionsByPeriod(user.id, start, end),
    getStandaloneEarningsByPeriod(user.id, start, end),
    getExpensesByPeriod(user.id, start, end),
  ]);

  const sessionEarnings = getSessionEarningsWithDate(sessions);
  const allEarnings = [...sessionEarnings, ...standaloneEarnings];

  const revenue = sumEarnings(allEarnings);
  const expensesTotal = expenses.reduce(
    (total, item) => total + getAmount(item.amount),
    0,
  );

  const profit = revenue - expensesTotal;

  const totalHours = sessions.reduce(
    (total, session) => total + getSessionHours(session),
    0,
  );

  const totalKm = sessions.reduce(
    (total, session) => total + getSessionKm(session),
    0,
  );

  const revenuePerHour = totalHours > 0 ? revenue / totalHours : 0;
  const revenuePerKm = totalKm > 0 ? revenue / totalKm : 0;

  const previousRange = getPreviousPeriodRange(period, referenceDate);
  const previousRevenue = await getRevenueByRange(
    user.id,
    previousRange.start,
    previousRange.end,
  );

  const revenueVariation =
    previousRevenue > 0
      ? ((revenue - previousRevenue) / previousRevenue) * 100
      : revenue > 0
        ? 100
        : 0;

  return {
    user,
    startDate: start,
    endDate: end,
    period,

    revenue,
    expenses: expensesTotal,
    profit,
    totalHours,
    totalKm,
    totalSessions: sessions.length,
    revenuePerHour,
    revenuePerKm,
    revenueVariation,

    platformTotals: groupPlatformTotals(allEarnings),
    barChartData: buildBarChartData(period, referenceDate, allEarnings),

    standaloneEarnings,
    sessionEarnings,
  };
}
