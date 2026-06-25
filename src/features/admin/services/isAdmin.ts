import { supabase } from '../../../database/supabase';

export async function isAdmin() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.user_role === 'admin';
}
