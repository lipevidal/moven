import { supabase } from '../../../database/supabase';

export async function getPendingChallenges() {
  const { data: entries, error } = await supabase
    .from('challenge_entries')
    .select(
      `
      id,
      user_id,
      vehicle_type,
      region,
      platforms,
      status,
      challenge_type,
      submitted_amount,
      reported_amount,
      approved_amount,
      created_at
      `,
    )
    .eq('status', 'under_review')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const userIds = [
    ...new Set(
      (entries ?? [])
        .map((item) => item.user_id)
        .filter(Boolean),
    ),
  ];

  if (!userIds.length) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, full_name, avatar_url, username')
    .in('id', userIds);

  if (profilesError) {
    throw profilesError;
  }

  return (entries ?? []).map((entry) => ({
    ...entry,
    user:
      profiles?.find((profile) => profile.id === entry.user_id) ??
      null,
  }));
}
