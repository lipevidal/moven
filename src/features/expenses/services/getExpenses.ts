import { supabase } from '../../../database/supabase';

type Params = {
  startDate?: string;
  endDate?: string;
  category?: string;
  vehicleId?: string;
  search?: string;
};

export async function getExpenses({
  startDate,
  endDate,
  category,
  vehicleId,
  search,
}: Params) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  let query = supabase
    .from('expenses')
    .select(`
      *,
      vehicle:vehicles(*)
    `)
    .eq('user_id', user.id)
    .order('expense_date', { ascending: false });

  if (startDate) {
    query = query.gte('expense_date', startDate);
  }

  if (endDate) {
    query = query.lte('expense_date', endDate);
  }

  if (category && category !== 'Todas') {
    query = query.eq('category', category);
  }

  if (vehicleId && vehicleId !== 'todos') {
    query = query.eq('vehicle_id', vehicleId);
  }

  if (search) {
    query = query.or(
      `description.ilike.%${search}%,location.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}