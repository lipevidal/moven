import { supabase } from '../../../database/supabase';

export async function getOnlineDriversByMunicipality(
  municipalityId: string,
) {
  const { data, error } = await supabase
    .from('work_sessions')
    .select(`
      id,
      status,
      user:profiles (
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('municipality_id', municipalityId)
    .in('status', ['active', 'paused']);

  if (error) throw error;

  return data ?? [];
}