import { supabase } from '../../../database/supabase';

type CreateExpenseParams = {
  vehicle_id?: string;

  category: string;

  description: string;

  location: string;

  amount: number;

  expense_date: Date;
};

export async function createExpense({
  vehicle_id,
  category,
  description,
  location,
  amount,
  expense_date,
}: CreateExpenseParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,

      vehicle_id,

      category,

      description,

      location,

      amount,

      expense_date:
        expense_date.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}