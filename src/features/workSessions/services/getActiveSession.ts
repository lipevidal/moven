import { supabase } from '../../../database/supabase';

export async function getActiveSession() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('work_sessions')
    .select(`
      *,
      vehicle:vehicles(*),
      earnings(*)
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}