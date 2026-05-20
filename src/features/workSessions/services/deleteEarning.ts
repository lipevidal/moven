import { supabase } from '../../../database/supabase';

export async function deleteEarning(earning_id: string) {
  const { error } = await supabase
    .from('earnings')
    .delete()
    .eq('id', earning_id);

  if (error) {
    throw error;
  }

  return true;
}