import { supabase } from '../../../database/supabase';

export async function deleteRide(rideId: string) {
  const { error } = await supabase
    .from('rides')
    .delete()
    .eq('id', rideId);

  if (error) {
    throw error;
  }

  return true;
}