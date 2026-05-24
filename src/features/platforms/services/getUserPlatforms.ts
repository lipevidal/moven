import { supabase } from '../../../database/supabase';

export async function getUserPlatforms() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('user_platforms')
    .select(`
      id,
      platform_id,
      is_active,
      platform:platforms(*)
    `)
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error) throw error;

  return data ?? [];
}