import { supabase } from '../../../database/supabase';

export async function getFriendRequests() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: requests, error } = await supabase
    .from('friendships')
    .select('id, requester_id, created_at')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const requesterIds = (requests ?? []).map((item) => item.requester_id);

  if (requesterIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, full_name, avatar_url, bio')
    .in('id', requesterIds);

  return (requests ?? []).map((request) => ({
    ...request,
    user: profiles?.find((profile) => profile.id === request.requester_id),
  }));
}