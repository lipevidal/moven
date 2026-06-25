import { supabase } from '../../../database/supabase';

export async function getCurrentChampions() {
  const { data, error } =
    await supabase
      .from('current_champions')
      .select(`
        *,
        user:profiles(
          id,
          full_name,
          avatar_url
        )
      `);

  if (error) throw error;

  return data ?? [];
}