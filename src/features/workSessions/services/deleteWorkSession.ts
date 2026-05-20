import { supabase } from '../../../database/supabase';

export async function deleteWorkSession(session_id: string) {
  const { error } = await supabase
    .from('work_sessions')
    .delete()
    .eq('id', session_id);

  if (error) {
    throw error;
  }

  return true;
}