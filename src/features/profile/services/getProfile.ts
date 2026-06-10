import { supabase } from '../../../database/supabase';

export async function getProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      default_municipality:municipalities(*)
    `)
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    ...data,
    email: data?.email ?? user.email,
    avatar_url:
      data?.avatar_url ??
      user.user_metadata?.avatar_url ??
      null,
    full_name:
      data?.full_name ??
      data?.name ??
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      'Motorista',
  };
}