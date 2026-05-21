import { supabase } from '../../../database/supabase';

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, -1);
}

export async function pauseWorkSession(session_id: string) {
  const { data, error } = await supabase
    .from('work_sessions')
    .update({
      status: 'paused',

      paused_at: toLocalISOString(new Date()),
    })
    .eq('id', session_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}