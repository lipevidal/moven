import { supabase } from '../../../database/supabase';

export async function getDashboardData() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: sessions } = await supabase
    .from('work_sessions')
    .select(`
      *,
      earnings(*)
    `)
    .eq('user_id', user.id)
    .eq('status', 'finished');

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id);

  const revenue =
    sessions?.reduce(
      (total, session) => {
        const sessionRevenue =
          session.earnings?.reduce(
            (
              sum: number,
              earning: any,
            ) =>
              sum +
              Number(
                earning.amount,
              ),
            0,
          ) ?? 0;

        return (
          total + sessionRevenue
        );
      },
      0,
    ) ?? 0;

  const totalExpenses =
    expenses?.reduce(
      (
        total,
        expense,
      ) =>
        total +
        Number(
          expense.amount,
        ),
      0,
    ) ?? 0;

  const totalKm =
    sessions?.reduce(
      (total, session) => {
        const km =
          Number(
            session.end_km,
          ) -
          Number(
            session.start_km,
          );

        return total + km;
      },
      0,
    ) ?? 0;

  const totalHours =
    sessions?.reduce(
      (total, session) => {
        const start =
          new Date(
            session.started_at,
          );

        const end =
          new Date(
            session.finished_at,
          );

        const diff =
          (end.getTime() -
            start.getTime()) /
          (1000 * 60 * 60);

        return total + diff;
      },
      0,
    ) ?? 0;

  const platformTotals =
    sessions?.reduce(
      (
        acc: any,
        session,
      ) => {
        session.earnings?.forEach(
          (
            earning: any,
          ) => {
            acc[
              earning.platform
            ] =
              (acc[
                earning
                  .platform
              ] ?? 0) +
              Number(
                earning.amount,
              );
          },
        );

        return acc;
      },
      {},
    ) ?? {};

  return {
    revenue,

    expenses:
      totalExpenses,

    profit:
      revenue -
      totalExpenses,

    totalKm,

    totalHours,

    totalSessions:
      sessions?.length ?? 0,

    platformTotals,
  };
}