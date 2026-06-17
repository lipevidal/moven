import { useEffect, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getPrivateConversations } from '../../src/features/privateChat/services/getPrivateConversations';

export default function ConversationsScreen() {
  const [conversations, setConversations] =
    useState<any[]>([]);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    setConversations(
      await getPrivateConversations(),
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={26}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <Text style={styles.title}>
          Conversas
        </Text>
      </View>

      {conversations.map((item) => (
        <TouchableOpacity
          key={item.user.id}
          style={styles.card}
          onPress={() =>
            router.push({
              pathname:
                '/(private)/chat-privado',
              params: {
                userId: item.user.id,
              },
            })
          }
        >
          {item.user.avatar_url ? (
            <Image
              source={{
                uri: item.user.avatar_url,
              }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={
                styles.avatarFallback
              }
            >
              <Ionicons
                name="person"
                size={20}
                color="#FFFFFF"
              />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {item.user.full_name ||
                item.user.name}
            </Text>

            <Text
              style={styles.message}
              numberOfLines={1}
            >
              {item.lastMessage?.message}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#71717A"
          />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 120,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },

  card: {
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 999,
  },

  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  name: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  message: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },

  emptyContainer: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 16,
  },

  emptyText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  lastMessageTime: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
});