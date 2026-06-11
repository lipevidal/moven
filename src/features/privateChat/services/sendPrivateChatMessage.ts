import { supabase } from '../../../database/supabase';

export async function sendPrivateChatMessage({
  receiverId,
  message,
  replyToMessageId,
}: {
  receiverId: string;
  message: string;
  replyToMessageId?: string | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuário não encontrado.');

  const { error } = await supabase
    .from('private_chat_messages')
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      message: message.trim(),
      reply_to_message_id: replyToMessageId ?? null,
    });

  if (error) throw error;
}