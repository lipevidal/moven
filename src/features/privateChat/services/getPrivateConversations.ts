import { supabase } from '../../../database/supabase';

export async function getPrivateConversations() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: messages } = await supabase
    .from('private_chat_messages')
    .select('*')
    .or(
      `sender_id.eq.${user.id},receiver_id.eq.${user.id}`,
    )
    .order('created_at', {
      ascending: false,
    });

  const ids = [
    ...new Set(
      (messages ?? []).map((item) =>
        item.sender_id === user.id
          ? item.receiver_id
          : item.sender_id,
      ),
    ),
  ];

  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id,name,full_name,avatar_url',
    )
    .in('id', ids);

  return ids.map((id) => {
    const lastMessage = messages?.find(
      (item) =>
        item.sender_id === id ||
        item.receiver_id === id,
    );

    return {
      user:
        profiles?.find(
          (profile) => profile.id === id,
        ) ?? null,
      lastMessage,
    };
  });
}