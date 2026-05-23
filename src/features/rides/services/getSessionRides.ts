import { supabase } from '../../../database/supabase';

export async function getSessionRides(sessionId: string) {
  const { data, error } = await supabase
    .from('rides')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}