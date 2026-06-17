import { useEffect, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getSharedResultComments } from '../../../src/features/sharedResults/services/getSharedResultComments';
import { addSharedResultComment } from '../../../src/features/sharedResults/services/addSharedResultComment';

export default function CommentsScreen() {
  const { sharedResultId } = useLocalSearchParams<{ sharedResultId: string }>();

  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState('');

  useEffect(() => {
    loadComments();
  }, [sharedResultId]);

  async function loadComments() {
    if (!sharedResultId) return;

    const response = await getSharedResultComments(sharedResultId);
    setComments(response);
  }

  async function handleSendComment() {
    if (!sharedResultId || !comment.trim()) return;

    await addSharedResultComment(sharedResultId, comment);

    setComment('');
    await loadComments();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.title}>Comentários</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {comments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubble-outline" size={42} color="#71717A" />

              <Text style={styles.emptyTitle}>Nenhum comentário</Text>

              <Text style={styles.emptyText}>
                Seja o primeiro a comentar esse resultado.
              </Text>
            </View>
          ) : (
            comments.map((item) => (
              <View key={item.id} style={styles.commentItem}>
                {item.user?.avatar_url ? (
                  <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person" size={18} color="#FFFFFF" />
                  </View>
                )}

                <View style={styles.commentBubble}>
                  <Text style={styles.commentName}>
                    {item.user?.full_name || item.user?.name || 'Motorista'}
                  </Text>

                  <Text style={styles.commentText}>{item.comment}</Text>

                  <Text style={styles.commentDate}>
                    {new Date(item.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Escreva um comentário..."
            placeholderTextColor="#71717A"
            style={styles.input}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              !comment.trim() && { opacity: 0.4 },
            ]}
            disabled={!comment.trim()}
            onPress={handleSendComment}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },

  emptyBox: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 14,
  },

  emptyText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
  },

  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  commentBubble: {
    flex: 1,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 18,
    padding: 12,
  },

  commentName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  commentText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
    lineHeight: 20,
  },

  commentDate: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    alignSelf: 'flex-end',
    marginTop: 6,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 96,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
  },

  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
});