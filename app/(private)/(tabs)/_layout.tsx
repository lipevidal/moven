import { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, StyleSheet, Platform, View } from 'react-native';
import { Tabs, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../src/database/supabase';

export default function TabsLayout() {
  const [hasActiveSession, setHasActiveSession] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadActiveSession();
    }, []),
  );

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function startRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel(`tabs-active-session-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'work_sessions',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadActiveSession();
          },
        )
        .subscribe();
    }

    startRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  async function loadActiveSession() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from('work_sessions')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'paused'])
      .maybeSingle();

    setHasActiveSession(!!data);
  }

  function renderTabIcon(
    iconName: keyof typeof Ionicons.glyphMap,
    focused: boolean,
    color: string,
  ) {
    return (
      <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
        <Ionicons
          name={iconName}
          size={22}
          color={focused ? '#06130B' : color}
        />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,

        tabBarStyle: {
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: 0,
          height: 74,
          backgroundColor: '#0B0B0F',
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: '#18181B',
          borderRadius: 28,
          paddingTop: 10,
          paddingBottom: 10,
          paddingHorizontal: 6,
          shadowColor: '#000000',
          shadowOffset: {
            width: 0,
            height: 12,
          },
          shadowOpacity: 0.35,
          shadowRadius: 20,
          elevation: 18,
        },

        tabBarItemStyle: {
          height: 54,
          alignItems: 'center',
          justifyContent: 'center',
        },

        tabBarActiveTintColor: '#22C55E',
        tabBarInactiveTintColor: '#71717A',
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('grid-outline', focused, color),
        }}
      />

      <Tabs.Screen
        name="despesas"
        options={{
          title: 'Despesas',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('card-outline', focused, color),
        }}
      />

      <Tabs.Screen
        name="jornadas"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="veiculos"
        options={{
          title: 'Veículos',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('car-sport-outline', focused, color),
        }}
      />

      <Tabs.Screen
        name="nova-jornada"
        options={{
          title: '',
          tabBarButton: () => (
            <TouchableOpacity
              activeOpacity={hasActiveSession ? 1 : 0.85}
              disabled={hasActiveSession}
              style={[
                styles.centerButton,
                hasActiveSession && styles.centerButtonDisabled,
              ]}
              onPress={() => router.push('/(private)/(tabs)/nova-jornada')}
            >
              <Ionicons
                name={hasActiveSession ? 'lock-closed-outline' : 'add'}
                size={30}
                color={hasActiveSession ? '#A1A1AA' : '#06130B'}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <Tabs.Screen
        name="recordes"
        options={{
          title: 'Meus recordes',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('podium-outline', focused, color),
        }}
      />

      <Tabs.Screen
        name="conversas"
        options={{
          title: 'Conversas',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('chatbubble-ellipses-outline', focused, color),
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('person-circle-outline', focused, color),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    width: 39,
    height: 39,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBoxActive: {
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },

  centerButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: -33,
    top: -27,

    width: 66,
    height: 66,
    borderRadius: 999,

    backgroundColor: '#22C55E',
    borderWidth: 5,
    borderColor: '#09090B',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 14,
  },

  centerButtonDisabled: {
    backgroundColor: '#27272A',
    borderColor: '#09090B',
    shadowOpacity: 0,
    elevation: 0,
  },
});
