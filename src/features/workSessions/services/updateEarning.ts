import { supabase } from '../../../database/supabase';

type UpdateEarningParams = {
  earning_id: string;
  amount: number;
};

export async function updateEarning({
  earning_id,
  amount,
}: UpdateEarningParams) {
  const { data, error } = await supabase
    .from('earnings')
    .update({
      amount,
    })
    .eq('id', earning_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}