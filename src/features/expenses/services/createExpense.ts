import { supabase } from '../../../database/supabase';

type CreateExpenseParams = {
  vehicle_id: string;
  category: string;
  amount: number;
  expense_date: string;
  location?: string;
  description?: string;
  maintenance_km?: number | null;
};

export async function createExpense({
  vehicle_id,
  category,
  amount,
  expense_date,
  location,
  description,
  maintenance_km,
}: CreateExpenseParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuário não autenticado.');
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      vehicle_id,
      category,
      amount,
      expense_date,
      location,
      description,
      maintenance_km,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}