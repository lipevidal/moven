import { supabase } from '../../../database/supabase';

export async function getSharedResults(type: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: results, error } = await supabase
    .from('shared_results')
    .select(`
      *,
      user:profiles (
        id,
        name,
        full_name,
        avatar_url
      )
    `)
    .eq('type', type)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const ids = (results ?? []).map((item) => item.id);

  if (ids.length === 0) return [];

  const [{ data: likes }, { data: comments }, { data: views }] =
    await Promise.all([
      supabase
        .from('shared_result_likes')
        .select('shared_result_id, user_id')
        .in('shared_result_id', ids),

      supabase
        .from('shared_result_comments')
        .select('shared_result_id')
        .in('shared_result_id', ids),

      supabase
        .from('shared_result_views')
        .select('shared_result_id')
        .in('shared_result_id', ids),
    ]);

  return (results ?? []).map((item) => ({
    ...item,
    likes_count:
      likes?.filter((like) => like.shared_result_id === item.id).length ?? 0,
    comments_count:
      comments?.filter((comment) => comment.shared_result_id === item.id)
        .length ?? 0,
    views_count:
      views?.filter((view) => view.shared_result_id === item.id).length ?? 0,
    liked_by_me:
      likes?.some(
        (like) =>
          like.shared_result_id === item.id && like.user_id === user?.id,
      ) ?? false,
  }));
}