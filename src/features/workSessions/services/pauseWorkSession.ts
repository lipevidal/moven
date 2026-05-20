import { supabase } from '../../../database/supabase';

export async function pauseWorkSession(session_id: string) {
  const { data, error } = await supabase
    .from('work_sessions')
    .update({
      status: 'paused',
    })
    .eq('id', session_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}