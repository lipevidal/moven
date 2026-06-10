import { supabase } from '../../../database/supabase';

export async function sendCityChatMessage(
  municipalityId: string,
  message: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuário não encontrado.');

  const { error } = await supabase.from('city_chat_messages').insert({
    municipality_id: municipalityId,
    user_id: user.id,
    message: message.trim(),
  });

  if (error) throw error;
}