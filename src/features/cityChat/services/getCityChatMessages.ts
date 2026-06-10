import { supabase } from '../../../database/supabase';

export async function getCityChatMessages(municipalityId: string) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: messages, error } = await supabase
    .from('city_chat_messages')
    .select('id, municipality_id, user_id, message, created_at')
    .eq('municipality_id', municipalityId)
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const userIds = [...new Set((messages ?? []).map((item) => item.user_id))];

  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, full_name, avatar_url')
    .in('id', userIds);

  return (messages ?? []).map((message) => ({
    ...message,
    user: profiles?.find((profile) => profile.id === message.user_id) ?? null,
  }));
}