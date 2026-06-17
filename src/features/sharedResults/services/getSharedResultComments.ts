import { supabase } from '../../../database/supabase';

export async function getSharedResultComments(sharedResultId: string) {
  const { data: comments, error } = await supabase
    .from('shared_result_comments')
    .select('id, user_id, comment, created_at')
    .eq('shared_result_id', sharedResultId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const userIds = [...new Set((comments ?? []).map((item) => item.user_id))];

  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, full_name, avatar_url')
    .in('id', userIds);

  return (comments ?? []).map((comment) => ({
    ...comment,
    user: profiles?.find((profile) => profile.id === comment.user_id) ?? null,
  }));
}