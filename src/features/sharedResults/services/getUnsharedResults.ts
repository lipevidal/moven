import { supabase } from '../../../database/supabase';

export async function getUnsharedResults(type: 'session' | 'day' | 'week' | 'month' | 'year') {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: shared } = await supabase
    .from('shared_results')
    .select('reference_id')
    .eq('user_id', user.id)
    .eq('type', type);

  const sharedIds = (shared ?? []).map((item) => item.reference_id);

  if (type === 'session') {
    const { data } = await supabase
      .from('work_sessions')
      .select('id, started_at, total_earnings, total_expenses, profit, worked_seconds, km_driven, gain_per_hour, gain_per_km')
      .eq('user_id', user.id)
      .eq('status', 'finished')
      .order('started_at', { ascending: false });

    return (data ?? []).filter((item) => !sharedIds.includes(item.id));
  }

  return [];
}