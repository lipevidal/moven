import { supabase } from '../../../database/supabase';

export type XpRankingScope = 'national' | 'regional';

export type XpRankingUser = {
  user_id: string;
  position: number;
  level: number;
  xp: number;
  total_xp: number;
  name: string;
  username: string | null;
  city: string | null;
  avatar_url: string | null;
  show_avatar: boolean;
};

export async function getXpRanking(scope: XpRankingScope) {
  let regionalCity: string | null = null;

  if (scope === 'regional') {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (user) {
      const { data: myProfile, error: myProfileError } = await supabase
        .from('profiles')
        .select('city, region')
        .eq('id', user.id)
        .maybeSingle();

      if (myProfileError) {
        throw myProfileError;
      }

      regionalCity = myProfile?.city || myProfile?.region || null;
    }
  }

  const { data: levels, error: levelsError } = await supabase
    .from('user_levels')
    .select('user_id, level, xp, total_xp')
    .order('total_xp', { ascending: false });

  if (levelsError) {
    throw levelsError;
  }

  const userIds = (levels ?? [])
    .map((item) => item.user_id)
    .filter(Boolean);

  if (userIds.length === 0) {
    return {
      city: regionalCity,
      ranking: [],
    };
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(
      `
      id,
      name,
      full_name,
      username,
      avatar_url,
      city,
      region,
      show_avatar,
      show_in_community
      `,
    )
    .in('id', userIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  const ranking = (levels ?? [])
    .map((level) => {
      const profile = profileMap.get(level.user_id);

      if (!profile) return null;

      const city = profile.city || profile.region || null;

      return {
        user_id: level.user_id,
        position: 0,
        level: Number(level.level ?? 1),
        xp: Number(level.xp ?? 0),
        total_xp: Number(level.total_xp ?? 0),
        name: profile.full_name || profile.name || 'Motorista',
        username: profile.username ?? null,
        city,
        avatar_url: profile.avatar_url ?? null,
        show_avatar: profile.show_avatar ?? true,
        show_in_community: profile.show_in_community ?? true,
      };
    })
    .filter((item): item is XpRankingUser & { show_in_community: boolean } => Boolean(item))
    .filter((item) => item.show_in_community !== false)
    .filter((item) => {
      if (scope === 'national') return true;
      if (!regionalCity) return false;

      return normalizeText(item.city) === normalizeText(regionalCity);
    })
    .sort((a, b) => b.total_xp - a.total_xp)
    .map((item, index) => ({
      ...item,
      position: index + 1,
    }));

  return {
    city: regionalCity,
    ranking,
  };
}

function normalizeText(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
