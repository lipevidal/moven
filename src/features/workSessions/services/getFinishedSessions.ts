import { supabase } from '../../../database/supabase';

export async function getFinishedSessions() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('work_sessions')
    .select(`
      *,
      vehicle:vehicles(*),
      earnings(*)
    `)
    .eq('user_id', user.id)
    .eq('status', 'finished')
    .order('finished_at', {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
}