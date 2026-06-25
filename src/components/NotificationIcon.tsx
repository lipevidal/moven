import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { router } from 'expo-router';

import { useNotificationBadge } from '../features/notifications/hooks/useNotificationBadge';

export default function NotificationIcon() {
  const count =
    useNotificationBadge();

  return (
    <TouchableOpacity
      onPress={() =>
        router.push(
          '/(private)/notifications',
        )
      }
    >
      <View>
        <Ionicons
          name="notifications-outline"
          size={26}
          color="#FFFFFF"
        />

        {count > 0 && (
          <View
            style={styles.badge}
          >
            <Text
              style={
                styles.badgeText
              }
            >
              {count > 99
                ? '99+'
                : count}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',

    right: -10,

    top: -6,

    minWidth: 18,

    height: 18,

    borderRadius: 999,

    backgroundColor: '#EF4444',

    justifyContent: 'center',

    alignItems: 'center',

    paddingHorizontal: 4,
  },

  badgeText: {
    color: '#FFFFFF',

    fontSize: 10,

    fontWeight: '900',
  },
});