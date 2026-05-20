import { supabase } from '../../../database/supabase';

type CreateEarningParams = {
  session_id: string;
  platform: string;
  amount: number;
};

export async function createEarning({
  session_id,
  platform,
  amount,
}: CreateEarningParams) {
  const { data, error } = await supabase
    .from('earnings')
    .insert({
      session_id,
      platform,
      category: platform,
      amount,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}