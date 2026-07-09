import { useCallback, useEffect, useState } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";

import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../../src/database/supabase";

type Conversation = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  updated_at: string;
  otherUser: {
    id: string;
    name?: string | null;
    full_name?: string | null;
    username?: string | null;
    city?: string | null;
    avatar_url?: string | null;
  } | null;
  lastMessage?: {
    body: string;
    sender_id: string;
    created_at: string;
  } | null;
  unreadCount: number;
};

function getUserName(user?: Conversation["otherUser"]) {
  return user?.full_name || user?.name || "Motorista";
}

function formatConversationDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function ConversationsListScreen() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, []),
  );

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`private-conversations-list-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_messages",
        },
        () => {
          loadConversations(false);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  async function loadConversations(showLoading = true) {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        router.replace("/login" as never);
        return;
      }

      setCurrentUserId(user.id);

      const { data: conversationsResponse, error: conversationsError } =
        await supabase
          .from("private_conversations")
          .select("id, user_a_id, user_b_id, updated_at")
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
          .order("updated_at", { ascending: false });

      if (conversationsError) throw conversationsError;

      const baseConversations = conversationsResponse ?? [];

      if (baseConversations.length === 0) {
        setConversations([]);
        return;
      }

      const otherUserIds = Array.from(
        new Set(
          baseConversations.map((conversation: any) =>
            conversation.user_a_id === user.id
              ? conversation.user_b_id
              : conversation.user_a_id,
          ),
        ),
      );

      const conversationIds = baseConversations.map(
        (conversation: any) => conversation.id,
      );

      const { data: profilesResponse, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, full_name, username, city, avatar_url")
        .in("id", otherUserIds);

      if (profilesError) throw profilesError;

      const { data: messagesResponse, error: messagesError } = await supabase
        .from("private_messages")
        .select("id, conversation_id, sender_id, receiver_id, body, read_at, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      if (messagesError) throw messagesError;

      const profilesMap = new Map(
        (profilesResponse ?? []).map((profile: any) => [profile.id, profile]),
      );

      const messagesByConversation = new Map<string, any[]>();

      (messagesResponse ?? []).forEach((message: any) => {
        const currentMessages =
          messagesByConversation.get(message.conversation_id) ?? [];

        currentMessages.push(message);
        messagesByConversation.set(message.conversation_id, currentMessages);
      });

      const mappedConversations: Conversation[] = baseConversations
        .map((conversation: any) => {
          const otherUserId =
            conversation.user_a_id === user.id
              ? conversation.user_b_id
              : conversation.user_a_id;

          const conversationMessages =
            messagesByConversation.get(conversation.id) ?? [];

          const lastMessage = conversationMessages[0] ?? null;

          const unreadCount = conversationMessages.filter(
            (message) => message.receiver_id === user.id && !message.read_at,
          ).length;

          return {
            id: conversation.id,
            user_a_id: conversation.user_a_id,
            user_b_id: conversation.user_b_id,
            updated_at: conversation.updated_at,
            otherUser: profilesMap.get(otherUserId) ?? null,
            lastMessage,
            unreadCount,
          };
        })
        .filter((conversation) => !!conversation.lastMessage);

      setConversations(mappedConversations);
    } catch (error: any) {
      console.log("Erro ao carregar conversas privadas:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openConversation(conversation: Conversation) {
    if (!conversation.otherUser?.id) return;

    router.push({
      pathname: "/conversa-privada/[userId]",
      params: { userId: conversation.otherUser.id },
    } as never);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#D4A64A" />
        <Text style={styles.loadingText}>Carregando conversas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.headerIconButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Mensagens</Text>
          <Text style={styles.headerTitle}>Conversas privadas</Text>
        </View>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            tintColor="#D4A64A"
            refreshing={refreshing}
            onRefresh={() => loadConversations(false)}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          conversations.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={42}
              color="#8F8A91"
            />
            <Text style={styles.emptyTitle}>Nenhuma conversa ainda</Text>
            <Text style={styles.emptyText}>
              Abra o perfil público de um motorista, toque em Enviar mensagem
              e envie a primeira mensagem para a conversa aparecer aqui.
            </Text>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.searchDriversButton}
              onPress={() => router.push("/buscar-motoristas" as never)}
            >
              <Ionicons name="search-outline" size={18} color="#080808" />
              <Text style={styles.searchDriversButtonText}>
                Buscar motoristas
              </Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const otherUser = item.otherUser;
          const lastMessagePrefix =
            item.lastMessage?.sender_id === currentUserId ? "Você: " : "";

          return (
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.conversationCard}
              onPress={() => openConversation(item)}
            >
              {otherUser?.avatar_url ? (
                <Image
                  source={{ uri: otherUser.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={24} color="#F5F0E6" />
                </View>
              )}

              <View style={styles.conversationInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {getUserName(otherUser)}
                  </Text>

                  <Text style={styles.dateText}>
                    {formatConversationDate(
                      item.lastMessage?.created_at ?? item.updated_at,
                    )}
                  </Text>
                </View>

                <Text style={styles.userMeta} numberOfLines={1}>
                  @{otherUser?.username || "usuario"} ·{" "}
                  {otherUser?.city || "Cidade não informada"}
                </Text>

                <Text
                  style={[
                    styles.lastMessage,
                    item.unreadCount > 0 && styles.lastMessageUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.lastMessage
                    ? `${lastMessagePrefix}${item.lastMessage.body}`
                    : "Conversa iniciada"}
                </Text>
              </View>

              {item.unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {item.unreadCount > 9 ? "9+" : item.unreadCount}
                  </Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#8F8A91" />
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#9B969B",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#070707",
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
    marginBottom: 14,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: "#F5F0E6",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 3,
    letterSpacing: -0.6,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 150,
    backgroundColor: "#050505",
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyCard: {
    minHeight: 260,
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: "#F5F0E6",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 13,
    textAlign: "center",
  },
  emptyText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 7,
    lineHeight: 19,
  },
  searchDriversButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#D4A64A",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 17,
  },
  searchDriversButtonText: {
    color: "#080808",
    fontSize: 14,
    fontWeight: "900",
  },
  conversationCard: {
    minHeight: 86,
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 11,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
  },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  conversationInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
  },
  dateText: {
    color: "#8F8A91",
    fontSize: 11,
    fontWeight: "800",
  },
  userMeta: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  lastMessage: {
    color: "#8F8A91",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
  lastMessageUnread: {
    color: "#F5F0E6",
    fontWeight: "900",
  },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  unreadBadgeText: {
    color: "#080808",
    fontSize: 11,
    fontWeight: "900",
  },
});
