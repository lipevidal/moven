import { useCallback, useState } from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getUnreadNotificationsCount } from '../services/getUnreadNotificationsCount';

type NotificationBellProps = {
  size?: number;
};

export function NotificationBell({
  size = 44,
}: NotificationBellProps) {
  const [count, setCount] =
    useState(0);

  useFocusEffect(
    useCallback(() => {
      loadCount();
    }, []),
  );

  async function loadCount() {
    try {
      const response =
        await getUnreadNotificationsCount();

      setCount(response);
    } catch (error) {
      console.log(error);
      setCount(0);
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 3,
        },
      ]}
      activeOpacity={0.85}
      onPress={() => router.push('/(private)/notifications')}
    >
      <Ionicons
        name="notifications-outline"
        size={22}
        color="#FFFFFF"
      />

      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
