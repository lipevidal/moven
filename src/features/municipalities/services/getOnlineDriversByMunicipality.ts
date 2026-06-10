import { supabase } from '../../../database/supabase';

export async function getOnlineDriversByMunicipality(municipalityId: string) {
  const { data: sessions, error: sessionsError } = await supabase
    .from('work_sessions')
    .select('id, user_id, status, municipality_id')
    .eq('municipality_id', municipalityId)
    .in('status', ['active', 'paused']);

  if (sessionsError) throw sessionsError;

  const userIds = [...new Set((sessions ?? []).map((item) => item.user_id))];

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, full_name, avatar_url')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  return (sessions ?? []).map((session) => {
    const profile = profiles?.find((item) => item.id === session.user_id);

    return {
      ...session,
      user: profile ?? null,
    };
  });
}