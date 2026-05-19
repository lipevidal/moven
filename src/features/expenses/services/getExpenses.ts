import { supabase } from '../../../database/supabase';

export async function getExpenses() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      vehicle:vehicles(*)
    `)
    .eq('user_id', user.id)
    .order('expense_date', {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
}