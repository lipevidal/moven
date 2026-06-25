import { supabase } from '../../../database/supabase';

export function sanitizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 24);
}

export async function checkUsernameAvailable(username: string) {
  const cleanUsername = sanitizeUsername(username);

  if (cleanUsername.length < 3) {
    return {
      available: false,
      username: cleanUsername,
      message: 'O username precisa ter pelo menos 3 caracteres.',
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', cleanUsername)
    .limit(1);

  if (error) {
    throw error;
  }

  const found = data?.[0];

  if (found && found.id !== user?.id) {
    return {
      available: false,
      username: cleanUsername,
      message: 'Este username já está em uso.',
    };
  }

  return {
    available: true,
    username: cleanUsername,
    message: 'Username disponível.',
  };
}
