import { supabase } from '../../../database/supabase';

export async function getLastMunicipality() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('work_sessions')
    .select(`
      municipality_id,
      municipality:municipalities(*)
    `)
    .eq('user_id', user.id)
    .not('municipality_id', 'is', null)
    .order('started_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.municipality ?? null;
}