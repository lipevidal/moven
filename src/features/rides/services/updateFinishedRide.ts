import { supabase } from '../../../database/supabase';

type Params = {
  ride_id: string;
  session_id: string;
  platform: string;
  old_amount: number;
  new_amount: number;
};

export async function updateFinishedRide({
  ride_id,
  session_id,
  platform,
  old_amount,
  new_amount,
}: Params) {
  const difference = new_amount - old_amount;

  const { data: earning, error: earningError } = await supabase
    .from('earnings')
    .select('*')
    .eq('session_id', session_id)
    .eq('platform', platform)
    .maybeSingle();

  if (earningError) throw earningError;

  if (earning) {
    await supabase
      .from('earnings')
      .update({
        amount: Number(earning.amount) + difference,
      })
      .eq('id', earning.id);
  }

  const { data, error } = await supabase
    .from('rides')
    .update({
      amount: new_amount,
    })
    .eq('id', ride_id)
    .select()
    .single();

  if (error) throw error;

  return data;
}