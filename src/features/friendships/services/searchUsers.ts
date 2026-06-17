import { supabase } from '../../../database/supabase';

export async function searchUsers(search: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || search.trim().length < 2) return [];

  const { data: blocks, error: blocksError } = await supabase
    .from('user_blocks')
    .select('blocked_id, blocker_id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

  if (blocksError) throw blocksError;

  const blockedIds = (blocks ?? []).map((item) =>
    item.blocker_id === user.id ? item.blocked_id : item.blocker_id,
  );

  let query = supabase
    .from('profiles')
    .select('id, name, full_name, avatar_url, bio')
    .neq('id', user.id)
    .or(`full_name.ilike.%${search}%,name.ilike.%${search}%`)
    .limit(20);

  if (blockedIds.length > 0) {
    query = query.not('id', 'in', `(${blockedIds.join(',')})`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data ?? [];
}