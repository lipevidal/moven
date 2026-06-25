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

export default function NotificationsScreen() {
  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [notifications, setNotifications] =
    useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, []),
  );

  async function loadNotifications() {
    try {
      setLoading(true);

      const response = await getNotifications();

      setNotifications(response);
    } catch (error) {
      console.log(error);
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
      await markAllNotificationsAsRead();
      await loadNotifications();
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ??
          'Não foi possível marcar as notificações como lidas.',
      );
    }
  }

  async function handlePressNotification(notification: any) {
    try {
      if (!notification.read) {
        await markNotificationAsRead(notification.id);
      }

      if (
        notification.reference_id &&
        (
          notification.type === 'challenge_approved' ||
          notification.type === 'challenge_rejected'
        )
      ) {
        router.push({
          pathname: '/(private)/desafios/[id]',
          params: {
            id: notification.reference_id,
          },
        });

        return;
      }

      if (
        notification.type === 'recordist_gold' ||
        notification.type === 'recordist_silver' ||
        notification.type === 'recordist_bronze'
      ) {
        router.push('/(private)/hall-of-fame');

        return;
      }

      if (
        notification.type === 'medal_gold' ||
        notification.type === 'medal_silver' ||
        notification.type === 'medal_bronze'
      ) {
        router.push('/(private)/rankings');

        return;
      }

      await loadNotifications();
    } catch (error) {
      console.log(error);
    }
  }

  function getUnreadCount() {
    return notifications.filter((item) => !item.read).length;
  }

  function getIcon(type: string) {
    if (type === 'challenge_approved') {
      return 'checkmark-circle-outline';
    }

    if (type === 'challenge_rejected') {
      return 'close-circle-outline';
    }

    if (
      type === 'recordist_gold' ||
      type === 'recordist_silver' ||
      type === 'recordist_bronze'
    ) {
      return 'trophy-outline';
    }

    if (
      type === 'medal_gold' ||
      type === 'medal_silver' ||
      type === 'medal_bronze'
    ) {
      return 'medal-outline';
    }

    return 'notifications-outline';
  }

  function getIconColor(type: string) {
    if (type === 'challenge_approved') {
      return '#22C55E';
    }

    if (type === 'challenge_rejected') {
      return '#EF4444';
    }

    if (
      type === 'recordist_gold' ||
      type === 'medal_gold'
    ) {
      return '#FACC15';
    }

    if (
      type === 'recordist_silver' ||
      type === 'medal_silver'
    ) {
      return '#CBD5E1';
    }

    if (
      type === 'recordist_bronze' ||
      type === 'medal_bronze'
    ) {
      return '#F97316';
    }

    return '#3B82F6';
  }

  function formatDate(value: string) {
    if (!value) return '';

    return new Date(value).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#22C55E"
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>
            Notificações
          </Text>

          <Text style={styles.subtitle}>
            Acompanhe aprovações, medalhas, recordes e avisos.
          </Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>
            Não lidas
          </Text>

          <Text style={styles.summaryValue}>
            {getUnreadCount()}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.markAllButton}
          onPress={handleMarkAllAsRead}
        >
          <Text style={styles.markAllButtonText}>
            Marcar todas como lidas
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#22C55E" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="notifications-off-outline"
            size={46}
            color="#71717A"
          />

          <Text style={styles.emptyTitle}>
            Nenhuma notificação
          </Text>

          <Text style={styles.emptyText}>
            Quando algo importante acontecer, você verá aqui.
          </Text>
        </View>
      ) : (
        notifications.map((item) => {
          const iconColor = getIconColor(item.type);

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.notificationCard,
                !item.read && styles.notificationCardUnread,
              ]}
              activeOpacity={0.85}
              onPress={() => handlePressNotification(item)}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    borderColor: iconColor,
                    backgroundColor: `${iconColor}22`,
                  },
                ]}
              >
                <Ionicons
                  name={getIcon(item.type)}
                  size={24}
                  color={iconColor}
                />
              </View>

              <View style={styles.notificationInfo}>
                <View style={styles.notificationTop}>
                  <Text
                    style={styles.notificationTitle}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>

                  {!item.read && (
                    <View style={styles.unreadDot} />
                  )}
                </View>

                <Text
                  style={styles.notificationMessage}
                  numberOfLines={3}
                >
                  {item.message}
                </Text>

                <Text style={styles.notificationDate}>
                  {formatDate(item.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    padding: 18,
    paddingTop: 54,
    paddingBottom: 130,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    flex: 1,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    lineHeight: 18,
  },

  summaryCard: {
    minHeight: 88,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  summaryLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
  },

  summaryValue: {
    color: '#22C55E',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },

  markAllButton: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  markAllButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  loadingBox: {
    minHeight: 220,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyBox: {
    minHeight: 260,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },

  notificationCard: {
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
  },

  notificationCardUnread: {
    borderColor: '#22C55E',
    backgroundColor: '#0B1F14',
  },

  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  notificationInfo: {
    flex: 1,
  },

  notificationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  notificationTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },

  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },

  notificationMessage: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 5,
  },

  notificationDate: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
});
