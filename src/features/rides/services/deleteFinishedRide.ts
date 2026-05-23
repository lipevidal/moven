import { supabase } from '../../../database/supabase';

type Params = {
  ride_id: string;
  session_id: string;
  platform: string;
  amount: number;
};

export async function deleteFinishedRide({
  ride_id,
  session_id,
  platform,
  amount,
}: Params) {
  const { data: earning, error: earningError } = await supabase
    .from('earnings')
    .select('*')
    .eq('session_id', session_id)
    .eq('platform', platform)
    .maybeSingle();

  if (earningError) throw earningError;

  if (earning) {
    const newAmount = Number(earning.amount) - amount;

    if (newAmount <= 0) {
      await supabase.from('earnings').delete().eq('id', earning.id);
    } else {
      await supabase
        .from('earnings')
        .update({ amount: newAmount })
        .eq('id', earning.id);
    }
  }

  const { error } = await supabase.from('rides').delete().eq('id', ride_id);

  if (error) throw error;

  return true;
}