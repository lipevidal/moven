import { supabase } from '../../../database/supabase';

type Params = {
  startDate?: string;
  endDate?: string;
  vehicleId?: string;
};

export async function getRevenueByPeriod({
  startDate,
  endDate,
  vehicleId,
}: Params) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  let query = supabase
    .from('earnings')
    .select(`
      amount,
      session:work_sessions!inner(
        id,
        user_id,
        vehicle_id,
        started_at
      )
    `)
    .eq('session.user_id', user.id);

  if (startDate) {
    query = query.gte('session.started_at', startDate);
  }

  if (endDate) {
    query = query.lte('session.started_at', endDate);
  }

  if (vehicleId && vehicleId !== 'todos') {
    query = query.eq('session.vehicle_id', vehicleId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).reduce(
    (total: number, item: any) => total + Number(item.amount ?? 0),
    0,
  );
}