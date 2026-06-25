import { supabase } from '../../../database/supabase';

type UpdateMyProfilePayload = {
  full_name?: string;
  username?: string;
  bio?: string;
  city?: string;
  region?: string;
  vehicle_type?: string;
  favorite_platform?: string;
  show_avatar?: boolean;
  share_statistics?: boolean;
  allow_private_messages?: boolean;
  show_in_community?: boolean;
};

export async function updateMyProfile(
  payload: UpdateMyProfilePayload,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const cleanUsername = payload.username
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '');

  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: payload.full_name?.trim() || null,
      username: cleanUsername || null,
      bio: payload.bio?.trim() || null,
      city: payload.city?.trim() || null,
      region: payload.region?.trim() || null,
      vehicle_type: payload.vehicle_type || null,
      favorite_platform: payload.favorite_platform || null,
      show_avatar: payload.show_avatar,
      share_statistics: payload.share_statistics,
      allow_private_messages: payload.allow_private_messages,
      show_in_community: payload.show_in_community,
    })
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Este nome de usuário já está em uso.');
    }

    throw error;
  }

  return data;
}
