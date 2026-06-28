import { supabase } from '../../../database/supabase';

export async function getCurrentUserIsAdmin() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!user?.id) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data?.is_admin);
}

export async function requireCurrentUserAdmin() {
  const isAdmin = await getCurrentUserIsAdmin();

  if (!isAdmin) {
    throw new Error('Acesso permitido somente para administradores.');
  }

  return true;
}
