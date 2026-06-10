import { supabase } from '../../../database/supabase';

export async function updateSessionMunicipality(
  sessionId: string,
  municipalityId: string,
) {
  const { data, error } = await supabase
    .from('work_sessions')
    .update({
      municipality_id: municipalityId,
    })
    .eq('id', sessionId)
    .select(`
      *,
      vehicle:vehicles(*),
      earnings(*),
      municipality:municipalities(*)
    `)
    .single();

  if (error) throw error;

  return data;
}