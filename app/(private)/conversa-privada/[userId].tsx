import { useCallback, useEffect, useRef, useState } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
} from "react-native";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../../../src/database/supabase";

type Profile = {
  id: string;
  name?: string | null;
  full_name?: string | null;
  username?: string | null;
  city?: string | null;
  avatar_url?: string | null;
};

type PrivateMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read_at?: string | null;
  created_at: string;
};

function getProfileName(profile?: Profile | null) {
  return profile?.full_name || profile?.name || "Motorista";
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PrivateChatScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const targetUserId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  const listRef = useRef<FlatList<PrivateMessage>>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadChat();
    }, [targetUserId]),
  );

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`private-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const nextMessage = payload.new as PrivateMessage;

          setMessages((currentMessages) => {
            const alreadyExists = currentMessages.some(
              (message) => message.id === nextMessage.id,
            );

            if (alreadyExists) return currentMessages;

            return [...currentMessages, nextMessage];
          });

          setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
          }, 80);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    markMessagesAsRead();
  }, [conversationId, currentUserId, messages.length]);

  async function loadChat() {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setConversationId(null);
      setMessages([]);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        router.replace("/login" as never);
        return;
      }

      if (user.id === targetUserId) {
        Alert.alert(
          "Atenção",
          "Você não pode iniciar uma conversa privada com você mesmo.",
        );
        router.back();
        return;
      }

      setCurrentUserId(user.id);

      const { data: profileResponse, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, full_name, username, city, avatar_url")
        .eq("id", targetUserId)
        .maybeSingle();

      if (profileError) throw profileError;

      setTargetProfile(profileResponse as Profile | null);

      /*
        Não cria conversa só de abrir a tela.
        Antes, get_or_create_private_conversation era chamado aqui,
        criando conversa vazia e fazendo aparecer na lista.

        Agora apenas buscamos se já existe conversa entre os dois usuários.
        Se não existir, a tela abre vazia e a conversa só será criada
        quando a primeira mensagem for enviada.
      */
      const { data: conversationsResponse, error: conversationSearchError } =
        await supabase
          .from("private_conversations")
          .select("id")
          .or(
            `and(user_a_id.eq.${user.id},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${user.id})`,
          )
          .maybeSingle();

      if (conversationSearchError) throw conversationSearchError;

      const existingConversationId = conversationsResponse?.id ?? null;

      if (!existingConversationId) {
        setConversationId(null);
        setMessages([]);
        return;
      }

      setConversationId(existingConversationId);

      const { data: messagesResponse, error: messagesError } = await supabase
        .from("private_messages")
        .select("id, conversation_id, sender_id, receiver_id, body, read_at, created_at")
        .eq("conversation_id", existingConversationId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      setMessages((messagesResponse ?? []) as PrivateMessage[]);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: false });
      }, 120);
    } catch (error: any) {
      console.log("Erro ao carregar conversa privada:", error);
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível abrir a conversa privada.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function markMessagesAsRead() {
    if (!conversationId || !currentUserId) return;

    const unreadMessages = messages.filter(
      (message) => message.receiver_id === currentUserId && !message.read_at,
    );

    if (unreadMessages.length === 0) return;

    const { error } = await supabase
      .from("private_messages")
      .update({ read_at: new Date().toISOString() })
      .in(
        "id",
        unreadMessages.map((message) => message.id),
      );

    if (error) {
      console.log("Erro ao marcar mensagens como lidas:", error);
    }
  }

  async function handleSendMessage() {
    const body = messageText.trim();

    if (!body || !currentUserId || !targetUserId || sending) {
      return;
    }

    try {
      setSending(true);
      setMessageText("");

      let resolvedConversationId = conversationId;

      if (!resolvedConversationId) {
        const { data: conversationResponse, error: conversationError } =
          await supabase.rpc("get_or_create_private_conversation", {
            target_user_id: targetUserId,
          });

        if (conversationError) throw conversationError;

        resolvedConversationId = String(conversationResponse);
        setConversationId(resolvedConversationId);
      }

      const { error } = await supabase.from("private_messages").insert({
        conversation_id: resolvedConversationId,
        sender_id: currentUserId,
        receiver_id: targetUserId,
        body,
      });

      if (error) throw error;

      /*
        Se a conversa acabou de ser criada, o canal realtime ainda pode não ter
        sido inscrito. Por isso recarregamos as mensagens após o primeiro envio.
      */
      const { data: messagesResponse, error: messagesError } = await supabase
        .from("private_messages")
        .select("id, conversation_id, sender_id, receiver_id, body, read_at, created_at")
        .eq("conversation_id", resolvedConversationId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      setMessages((messagesResponse ?? []) as PrivateMessage[]);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch (error: any) {
      console.log("Erro ao enviar mensagem privada:", error);
      setMessageText(body);
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível enviar a mensagem.",
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#22C55E" />
        <Text style={styles.loadingText}>Abrindo conversa...</Text>
      </View>
    );
  }

  if (!targetProfile) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-circle-outline" size={46} color="#71717A" />
        <Text style={styles.notFoundTitle}>Perfil não encontrado</Text>
        <Text style={styles.notFoundText}>
          Não foi possível encontrar este usuário.
        </Text>

        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.backButtonLarge}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonLargeText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.headerIconButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {targetProfile.avatar_url ? (
            <Image
              source={{ uri: targetProfile.avatar_url }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Ionicons name="person" size={21} color="#FFFFFF" />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {getProfileName(targetProfile)}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              @{targetProfile.username || "usuario"} ·{" "}
              {targetProfile.city || "Cidade não informada"}
            </Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.messagesContent,
            messages.length === 0 && styles.messagesContentEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyMessagesCard}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={38}
                color="#52525B"
              />
              <Text style={styles.emptyMessagesTitle}>
                Comece a conversa
              </Text>
              <Text style={styles.emptyMessagesText}>
                Envie uma mensagem privada para {getProfileName(targetProfile)}.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMine = item.sender_id === currentUserId;

            return (
              <View
                style={[
                  styles.messageRow,
                  isMine ? styles.messageRowMine : styles.messageRowOther,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isMine ? styles.messageBubbleMine : styles.messageBubbleOther,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isMine ? styles.messageTextMine : styles.messageTextOther,
                    ]}
                  >
                    {item.body}
                  </Text>

                  <Text
                    style={[
                      styles.messageTime,
                      isMine ? styles.messageTimeMine : styles.messageTimeOther,
                    ]}
                  >
                    {formatMessageTime(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.inputContainer}>
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Digite uma mensagem..."
            placeholderTextColor="#71717A"
            style={styles.input}
            multiline
          />

          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#06130B" size="small" />
            ) : (
              <Ionicons name="send" size={19} color="#06130B" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: "#09090B",
  },
  container: {
    flex: 1,
    backgroundColor: "#09090B",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#09090B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#A1A1AA",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
  },
  notFoundTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
  },
  notFoundText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 7,
  },
  backButtonLarge: {
    height: 46,
    borderRadius: 16,
    backgroundColor: "#22C55E",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  backButtonLargeText: {
    color: "#06130B",
    fontSize: 14,
    fontWeight: "900",
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#18181B",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
  },
  headerAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  messagesContentEmpty: {
    justifyContent: "center",
  },
  emptyMessagesCard: {
    minHeight: 190,
    borderRadius: 26,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  emptyMessagesTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyMessagesText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 7,
  },
  messageRow: {
    marginBottom: 10,
    flexDirection: "row",
  },
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "82%",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleMine: {
    backgroundColor: "#22C55E",
    borderBottomRightRadius: 6,
  },
  messageBubbleOther: {
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  messageTextMine: {
    color: "#06130B",
  },
  messageTextOther: {
    color: "#FFFFFF",
  },
  messageTime: {
    fontSize: 10,
    fontWeight: "900",
    marginTop: 5,
    alignSelf: "flex-end",
  },
  messageTimeMine: {
    color: "rgba(6,19,11,0.62)",
  },
  messageTimeOther: {
    color: "#71717A",
  },
  inputContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 26 : 14,
    borderTopWidth: 1,
    borderTopColor: "#18181B",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
