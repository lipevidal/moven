import { supabase } from '../../../database/supabase';

export async function markCityChatAsRead(municipalityId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from('city_chat_reads').upsert(
    {
      municipality_id: municipalityId,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    {
      onConflict: 'municipality_id,user_id',
    },
  );
}