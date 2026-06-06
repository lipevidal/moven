import { supabase } from '../../../database/supabase';

export type DashboardPeriod = 'day' | 'week' | 'month' | 'year';

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
}

function getPeriodRange(period: DashboardPeriod, baseDate = new Date()) {
  const start = new Date(baseDate);
  const end = new Date(baseDate);

  if (period === 'day') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (period === 'week') {
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  }

  if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    end.setMonth(start.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  }

  if (period === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);

    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

function getPreviousRange(period: DashboardPeriod, start: Date, end: Date) {
  const previousStart = new Date(start);
  const previousEnd = new Date(end);

  if (period === 'day') {
    previousStart.setDate(previousStart.getDate() - 1);
    previousEnd.setDate(previousEnd.getDate() - 1);
  }

  if (period === 'week') {
    previousStart.setDate(previousStart.getDate() - 7);
    previousEnd.setDate(previousEnd.getDate() - 7);
  }

  if (period === 'month') {
    previousStart.setMonth(previousStart.getMonth() - 1);
    previousEnd.setMonth(previousEnd.getMonth() - 1);
  }

  if (period === 'year') {
    previousStart.setFullYear(previousStart.getFullYear() - 1);
    previousEnd.setFullYear(previousEnd.getFullYear() - 1);
  }

  return {
    start: previousStart,
    end: previousEnd,
  };
}

function calculateSessionsRevenue(sessions: any[]) {
  return sessions.reduce((total, session) => {
    const sessionRevenue =
      session.earnings?.reduce(
        (sum: number, earning: any) => sum + Number(earning.amount ?? 0),
        0,
      ) ?? 0;

    return total + sessionRevenue;
  }, 0);
}

function calculateTotalHours(sessions: any[]) {
  return sessions.reduce((total, session) => {
    const start = new Date(session.started_at).getTime();
    const end = new Date(session.finished_at).getTime();

    const totalPausedSeconds = Number(session.total_paused_seconds ?? 0);

    const seconds = Math.max(
      Math.floor((end - start) / 1000) - totalPausedSeconds,
      0,
    );

    return total + seconds / 3600;
  }, 0);
}

function calculateTotalKm(sessions: any[]) {
  return sessions.reduce((total, session) => {
    const km =
      Number(session.end_km ?? 0) - Number(session.start_km ?? 0);

    return total + Math.max(km, 0);
  }, 0);
}

function calculatePlatformTotals(sessions: any[]) {
  return sessions.reduce((acc: Record<string, number>, session) => {
    session.earnings?.forEach((earning: any) => {
      acc[earning.platform] =
        (acc[earning.platform] ?? 0) + Number(earning.amount ?? 0);
    });

    return acc;
  }, {});
}

function calculateVariation(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;

  return ((current - previous) / previous) * 100;
}

export async function getDashboardData(
  period: DashboardPeriod,
  referenceDate = new Date(),
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { start, end } = getPeriodRange(period, referenceDate);
  const previous = getPreviousRange(period, start, end);

  const [sessionsResponse, expensesResponse, previousSessionsResponse, vehiclesResponse] =
    await Promise.all([
      supabase
        .from('work_sessions')
        .select(`
          *,
          earnings(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .gte('started_at', toLocalISOString(start))
        .lte('started_at', toLocalISOString(end)),

      supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('expense_date', toLocalISOString(start))
        .lte('expense_date', toLocalISOString(end)),

      supabase
        .from('work_sessions')
        .select(`
          *,
          earnings(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .gte('started_at', toLocalISOString(previous.start))
        .lte('started_at', toLocalISOString(previous.end)),

      supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false }),
    ]);

  if (sessionsResponse.error) throw sessionsResponse.error;
  if (expensesResponse.error) throw expensesResponse.error;
  if (previousSessionsResponse.error) throw previousSessionsResponse.error;
  if (vehiclesResponse.error) throw vehiclesResponse.error;

  const sessions = sessionsResponse.data ?? [];
  const expenses = expensesResponse.data ?? [];
  const previousSessions = previousSessionsResponse.data ?? [];
  const vehicles = vehiclesResponse.data ?? [];

  const revenue = calculateSessionsRevenue(sessions);
  const previousRevenue = calculateSessionsRevenue(previousSessions);

  const totalExpenses = expenses.reduce(
    (total, expense) => total + Number(expense.amount ?? 0),
    0,
  );

  const totalKm = calculateTotalKm(sessions);
  const totalHours = calculateTotalHours(sessions);

  const profit = revenue - totalExpenses;

  const revenuePerHour = totalHours > 0 ? revenue / totalHours : 0;
  const revenuePerKm = totalKm > 0 ? revenue / totalKm : 0;

  const platformTotals = calculatePlatformTotals(sessions);

  const revisionVehicles = vehicles
    .filter(
      (vehicle) =>
        vehicle.current_km !== null &&
        vehicle.next_revision_km !== null,
    )
    .map((vehicle) => ({
      ...vehicle,
      kmUntilRevision:
        Number(vehicle.next_revision_km) - Number(vehicle.current_km),
    }))
    .sort((a, b) => a.kmUntilRevision - b.kmUntilRevision);

  const nextRevision = revisionVehicles[0] ?? null;

  function getBarChartData() {
    if (period === 'day') {
      return [];
    }

    if (period === 'week') {
      const days = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
      const { start } = getPeriodRange('week', referenceDate);

      return days.map((label, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);

        const value = sessions
          .filter((session) => {
            const sessionDate = new Date(session.started_at);

            return (
              sessionDate.getDate() === day.getDate() &&
              sessionDate.getMonth() === day.getMonth() &&
              sessionDate.getFullYear() === day.getFullYear()
            );
          })
          .reduce((total, session) => {
            return (
              total +
              (session.earnings?.reduce(
                (sum: number, earning: any) =>
                  sum + Number(earning.amount ?? 0),
                0,
              ) ?? 0)
            );
          }, 0);

        return {
          label,
          value,
        };
      });
    }

    if (period === 'month') {
      return Array.from({ length: 5 }).map((_, index) => {
        const weekDate = new Date(referenceDate);
        weekDate.setDate(referenceDate.getDate() - (4 - index) * 7);

        const { start, end } = getPeriodRange('week', weekDate);

        const value = sessions
          .filter((session) => {
            const sessionDate = new Date(session.started_at);

            return sessionDate >= start && sessionDate <= end;
          })
          .reduce((total, session) => {
            return (
              total +
              (session.earnings?.reduce(
                (sum: number, earning: any) =>
                  sum + Number(earning.amount ?? 0),
                0,
              ) ?? 0)
            );
          }, 0);

        const startDay = String(start.getDate()).padStart(2, '0');
        const endDay = String(end.getDate()).padStart(2, '0');

        const monthName = [
          'Jan',
          'Fev',
          'Mar',
          'Abr',
          'Mai',
          'Jun',
          'Jul',
          'Ago',
          'Set',
          'Out',
          'Nov',
          'Dez',
        ][end.getMonth()];

        return {
          label: `${startDay}-${endDay}${monthName}`,
          value,
        };
      });
    }

    return Array.from({ length: 5 }).map((_, index) => {
      const year = referenceDate.getFullYear() - (4 - index);

      const value = sessions
        .filter((session) => {
          return new Date(session.started_at).getFullYear() === year;
        })
        .reduce((total, session) => {
          return (
            total +
            (session.earnings?.reduce(
              (sum: number, earning: any) =>
                sum + Number(earning.amount ?? 0),
              0,
            ) ?? 0)
          );
        }, 0);

      return {
        label: String(year),
        value,
      };
    });
  }

  return {
    user,
    period,
    startDate: start,
    endDate: end,
    barChartData: getBarChartData(),

    revenue,
    previousRevenue,
    revenueVariation: calculateVariation(revenue, previousRevenue),

    expenses: totalExpenses,
    profit,

    totalKm,
    totalHours,

    revenuePerHour,
    revenuePerKm,

    totalSessions: sessions.length,

    platformTotals,
    nextRevision,
  };
}