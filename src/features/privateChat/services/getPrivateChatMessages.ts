import { supabase } from '../../../database/supabase';

export async function getPrivateChatMessages(otherUserId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: messages, error } = await supabase
    .from('private_chat_messages')
    .select(`
      id,
      sender_id,
      receiver_id,
      message,
      reply_to_message_id,
      created_at
    `)
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`,
    )
    .order('created_at', { ascending: true });

  if (error) throw error;

  const userIds = [
    ...new Set(
      (messages ?? []).flatMap((item) => [
        item.sender_id,
        item.receiver_id,
      ]),
    ),
  ];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, full_name, avatar_url')
    .in('id', userIds);

  return (messages ?? []).map((message) => {
    const sender = profiles?.find((p) => p.id === message.sender_id);

    const repliedMessage = messages?.find(
      (item) => item.id === message.reply_to_message_id,
    );

    return {
      ...message,
      sender,
      repliedMessage,
    };
  });
}