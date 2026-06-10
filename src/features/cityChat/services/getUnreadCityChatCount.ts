import { supabase } from '../../../database/supabase';

export async function getUnreadCityChatCount(municipalityId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { data: read } = await supabase
    .from('city_chat_reads')
    .select('last_read_at')
    .eq('municipality_id', municipalityId)
    .eq('user_id', user.id)
    .maybeSingle();

  const since =
    read?.last_read_at ??
    new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('city_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('municipality_id', municipalityId)
    .gt('created_at', since)
    .neq('user_id', user.id);

  if (error) throw error;

  return count ?? 0;
}