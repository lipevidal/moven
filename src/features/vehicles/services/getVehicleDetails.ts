import { supabase } from '../../../database/supabase';

export async function getVehicleDetails(vehicleId: string) {
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .single();

  if (vehicleError) throw vehicleError;

  const { data: sessions, error: sessionsError } = await supabase
    .from('work_sessions')
    .select('*, earnings(*)')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false });

  if (sessionsError) throw sessionsError;

  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('expense_date', { ascending: false });

  if (expensesError) throw expensesError;

  return {
    vehicle,
    sessions: sessions ?? [],
    expenses: expenses ?? [],
  };
}