import { supabase } from '../../../database/supabase';

export async function getProfile(userId?: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const targetUserId = userId ?? user?.id;

  if (!targetUserId) {
    return null;
  }

  /*
    Não faça embed direto com municipalities aqui.

    O seu banco tem duas relações entre profiles e municipalities:
    - profiles.municipality_id
    - profiles.default_municipality_id

    Então consultas como:
    municipality:municipalities(...)
    ou
    municipalities(...)
    geram PGRST201.

    Por isso buscamos o perfil primeiro e depois buscamos a cidade
    separadamente pela coluna default_municipality_id ou municipality_id.
  */
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      `
      id,
      name,
      full_name,
      username,
      email,
      city,
      region,
      avatar_url,
      created_at,
      default_municipality_id,
      municipality_id,
      is_admin,
      is_active,
      subscription_status
      `,
    )
    .eq('id', targetUserId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return null;
  }

  const municipalityId =
    profile.default_municipality_id ?? profile.municipality_id ?? null;

  let municipality = null;

  if (municipalityId) {
    const { data: municipalityResponse, error: municipalityError } =
      await supabase
        .from('municipalities')
        .select('id, name, uf, state_name, immediate_region')
        .eq('id', municipalityId)
        .maybeSingle();

    if (municipalityError) {
      throw municipalityError;
    }

    municipality = municipalityResponse ?? null;
  }

  return {
    ...profile,
    email: profile.email ?? (targetUserId === user?.id ? user?.email : null),
    city: profile.city ?? municipality?.name ?? null,
    municipality,
    municipality_id: profile.municipality_id ?? municipality?.id ?? null,
    default_municipality_id:
      profile.default_municipality_id ?? municipality?.id ?? null,
    user_metadata: targetUserId === user?.id ? user?.user_metadata : undefined,
  };
}
