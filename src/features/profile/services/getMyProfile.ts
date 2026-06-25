import { supabase } from '../../../database/supabase';

export async function getMyProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      id,
      name,
      full_name,
      username,
      avatar_url,
      bio,
      city,
      region,
      vehicle_type,
      favorite_platform,
      show_avatar,
      share_statistics,
      allow_private_messages,
      show_in_community
      `,
    )
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
