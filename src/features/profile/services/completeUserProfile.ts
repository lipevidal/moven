import { supabase } from '../../../database/supabase';
import { CityOption } from './searchCities';
import { sanitizeUsername } from './checkUsernameAvailable';

type CompleteUserProfilePayload = {
  fullName: string;
  username: string;
  city: CityOption;
};

export async function completeUserProfile({
  fullName,
  username,
  city,
}: CompleteUserProfilePayload) {
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

  const cleanUsername = sanitizeUsername(username);

  if (cleanUsername.length < 3) {
    throw new Error('O username precisa ter pelo menos 3 caracteres.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email,
        full_name: fullName.trim(),
        name: fullName.trim(),
        username: cleanUsername,
        city: city.name,
        region: city.name,
        default_municipality_id: city.id ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
        show_in_community: true,
        show_avatar: true,
      },
      {
        onConflict: 'id',
      },
    )
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Este username já está em uso.');
    }

    throw error;
  }

  return data;
}
