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
      earnings(*),
      municipality:municipalities(*)
    `)
    .eq('user_id', user.id)
    .in('status', ['active', 'paused'])
    .order('started_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}