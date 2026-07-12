import { useCallback, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getNotifications } from '../../../src/features/notifications/services/getNotifications';
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../../../src/features/notifications/services/markNotificationAsRead';

type IconName = keyof typeof Ionicons.glyphMap;

type NotificationItem = {
  id: string;
  title?: string | null;
  message?: string | null;
  type?: string | null;
  read?: boolean | null;
  created_at?: string | null;
};

type NotificationVisual = {
  icon: IconName;
  color: string;
  backgroundColor: string;
  borderColor: string;
};

function normalizeType(type?: string | null) {
  return String(type ?? '').trim().toLowerCase();
}

function getNotificationVisual(type?: string | null): NotificationVisual {
  const normalizedType = normalizeType(type);

  if (normalizedType === 'goal_completed') {
    return {
      icon: 'checkmark-circle-outline',
      color: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.28)',
    };
  }

  if (normalizedType === 'goal_failed') {
    return {
      icon: 'close-circle-outline',
      color: '#EF4444',
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderColor: 'rgba(239,68,68,0.28)',
    };
  }

  if (normalizedType === 'admin_due_date_updated') {
    return {
      icon: 'calendar-outline',
      color: '#60A5FA',
      backgroundColor: 'rgba(96,165,250,0.12)',
      borderColor: 'rgba(96,165,250,0.28)',
    };
  }

  if (normalizedType === 'admin_discount_applied') {
    return {
      icon: 'pricetag-outline',
      color: '#FACC15',
      backgroundColor: 'rgba(250,204,21,0.12)',
      borderColor: 'rgba(250,204,21,0.28)',
    };
  }

  if (normalizedType === 'admin_discount_removed') {
    return {
      icon: 'pricetag',
      color: '#F97316',
      backgroundColor: 'rgba(249,115,22,0.12)',
      borderColor: 'rgba(249,115,22,0.28)',
    };
  }

  if (normalizedType === 'admin_role_enabled') {
    return {
      icon: 'shield-checkmark-outline',
      color: '#60A5FA',
      backgroundColor: 'rgba(96,165,250,0.12)',
      borderColor: 'rgba(96,165,250,0.28)',
    };
  }

  if (normalizedType === 'admin_role_disabled') {
    return {
      icon: 'shield-outline',
      color: '#F87171',
      backgroundColor: 'rgba(248,113,113,0.12)',
      borderColor: 'rgba(248,113,113,0.28)',
    };
  }

  if (normalizedType === 'admin_free_plan_enabled') {
    return {
      icon: 'gift-outline',
      color: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.28)',
    };
  }

  if (normalizedType === 'admin_free_plan_disabled') {
    return {
      icon: 'gift',
      color: '#F87171',
      backgroundColor: 'rgba(248,113,113,0.12)',
      borderColor: 'rgba(248,113,113,0.28)',
    };
  }

  return {
    icon: 'notifications-outline',
    color: '#D4A64A',
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderColor: 'rgba(212,166,74,0.28)',
  };
}

function formatDate(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, []),
  );

  async function loadNotifications() {
    try {
      setLoading(true);

      const response = await getNotifications();

      setNotifications(response ?? []);
    } catch (error) {
      console.log('Erro ao carregar notificações:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadNotifications();
  }

  async function handleMarkAllAsRead() {
    try {
      if (getUnreadCount() === 0) return;

      await markAllNotificationsAsRead();
      await loadNotifications();
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível marcar as notificações como lidas.',
      );
    }
  }

  async function handlePressNotification(notification: NotificationItem) {
    try {
      if (!notification.read) {
        await markNotificationAsRead(notification.id);
      }

      await loadNotifications();
    } catch (error) {
      console.log('Erro ao marcar notificação como lida:', error);
    }
  }

  function getUnreadCount() {
    return notifications.filter((item) => !item.read).length;
  }

  const unreadCount = getUnreadCount();
  const hasNotifications = notifications.length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.headerIconButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerEyebrow}>Central de avisos</Text>
          <Text style={styles.headerTitle}>Notificações</Text>
          <Text style={styles.headerSubtitle}>
            Acompanhe avisos importantes do MovenApp.
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#D4A64A"
          />
        }
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconBox}>
            <Ionicons name="notifications-outline" size={24} color="#D4A64A" />
          </View>

          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Não lidas</Text>
            <Text style={styles.summaryValue}>{unreadCount}</Text>
            <Text style={styles.summaryHint}>
              {hasNotifications
                ? `${notifications.length} notificação(ões) no total`
                : 'Nenhuma notificação recebida'}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            style={[
              styles.markAllButton,
              unreadCount === 0 && styles.markAllButtonDisabled,
            ]}
            disabled={unreadCount === 0}
            onPress={handleMarkAllAsRead}
          >
            <Text
              style={[
                styles.markAllButtonText,
                unreadCount === 0 && styles.markAllButtonTextDisabled,
              ]}
            >
              Marcar todas
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator color="#D4A64A" />
            <Text style={styles.feedbackText}>Carregando notificações...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <Ionicons
                name="notifications-off-outline"
                size={34}
                color="#9B969B"
              />
            </View>

            <Text style={styles.emptyTitle}>Nenhuma notificação</Text>

            <Text style={styles.emptyText}>
              Quando algo importante acontecer, você verá aqui.
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map((item) => {
              const visual = getNotificationVisual(item.type);
              const unread = !item.read;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.88}
                  style={[
                    styles.notificationCard,
                    unread && styles.notificationCardUnread,
                  ]}
                  onPress={() => handlePressNotification(item)}
                >
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor: visual.backgroundColor,
                        borderColor: visual.borderColor,
                      },
                    ]}
                  >
                    <Ionicons
                      name={visual.icon}
                      size={23}
                      color={visual.color}
                    />
                  </View>

                  <View style={styles.notificationInfo}>
                    <View style={styles.notificationTop}>
                      <Text style={styles.notificationTitle} numberOfLines={2}>
                        {item.title || 'Notificação'}
                      </Text>

                      {unread ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>Nova</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.notificationMessage} numberOfLines={4}>
                      {item.message || 'Você possui uma nova notificação.'}
                    </Text>

                    <View style={styles.notificationFooter}>
                      <View style={styles.notificationDateRow}>
                        <Ionicons
                          name="time-outline"
                          size={13}
                          color="#8F8A91"
                        />
                        <Text style={styles.notificationDate}>
                          {formatDate(item.created_at)}
                        </Text>
                      </View>

                      {unread ? <View style={styles.unreadDot} /> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },

  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 132,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
    zIndex: 50,
    elevation: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },

  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerInfo: {
    flex: 1,
  },

  headerEyebrow: {
    color: '#D4A64A',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.7,
  },

  headerTitle: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.1,
  },

  headerSubtitle: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },

  summaryCard: {
    minHeight: 96,
    borderRadius: 18,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    shadowColor: '#D4A64A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 6,
  },

  summaryIconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryInfo: {
    flex: 1,
  },

  summaryLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
  },

  summaryValue: {
    color: '#F5F0E6',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 1,
  },

  summaryHint: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  markAllButton: {
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  markAllButtonDisabled: {
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
  },

  markAllButtonText: {
    color: '#080808',
    fontSize: 12,
    fontWeight: '900',
  },

  markAllButtonTextDisabled: {
    color: '#8F8A91',
  },

  feedbackCard: {
    minHeight: 220,
    borderRadius: 18,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  feedbackText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
  },

  emptyCard: {
    minHeight: 260,
    borderRadius: 18,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  emptyIconBox: {
    width: 70,
    height: 70,
    borderRadius: 18,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 14,
  },

  emptyText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },

  notificationsList: {
    gap: 10,
  },

  notificationCard: {
    borderRadius: 18,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },

  notificationCardUnread: {
    backgroundColor: '#12130F',
    borderColor: 'rgba(212,166,74,0.42)',
  },

  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationInfo: {
    flex: 1,
  },

  notificationTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },

  notificationTitle: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },

  unreadBadge: {
    minHeight: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.32)',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  unreadBadgeText: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
  },

  notificationMessage: {
    color: '#D8D1C4',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },

  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
  },

  notificationDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  notificationDate: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '800',
  },

  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
  },
});
