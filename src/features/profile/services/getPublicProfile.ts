import { supabase } from '../../../database/supabase';

export async function getPublicProfile(userId: string) {
  const { data: profile, error: profileError } = await supabase
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
      created_at
      `,
    )
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const { data: level } = await supabase
    .from('user_levels')
    .select('level, xp, total_xp')
    .eq('user_id', userId)
    .maybeSingle();

  const { count: medalsCount } = await supabase
    .from('medals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: trophiesCount } = await supabase
    .from('trophies')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { data: challenges } = await supabase
    .from('challenge_entries')
    .select(
      `
      id,
      challenge_type,
      vehicle_type,
      region,
      approved_amount,
      position,
      medal,
      created_at
      `,
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10);

  return {
    profile,
    level: level ?? {
      level: 1,
      xp: 0,
      total_xp: 0,
    },
    medalsCount: medalsCount ?? 0,
    trophiesCount: trophiesCount ?? 0,
    challenges: challenges ?? [],
  };
}
