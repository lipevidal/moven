import { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../src/database/supabase';

export default function TabsLayout() {
  const [hasActiveSession, setHasActiveSession] = useState(false);

  useEffect(() => {
    loadActiveSession();
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          height: 72,
          backgroundColor: '#09090B',
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: 8,
          elevation: 12,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },

        tabBarActiveTintColor: '#22C55E',
        tabBarInactiveTintColor: '#71717A',
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="despesas"
        options={{
          title: 'Despesas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="jornadas"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="nova-jornada"
        options={{
          title: '',
          tabBarButton: () => (
            <TouchableOpacity
              activeOpacity={hasActiveSession ? 1 : 0.8}
              disabled={hasActiveSession}
              style={[
                styles.centerButton,
                hasActiveSession && styles.centerButtonDisabled,
              ]}
              onPress={() => router.push('/(private)/(tabs)/nova-jornada')}
            >
              <Ionicons
                name="add"
                size={30}
                color={hasActiveSession ? '#A1A1AA' : '#FFFFFF'}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <Tabs.Screen
        name="veiculos"
        options={{
          title: 'Veículos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-sport-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="recordes"
        options={{
          title: "Recordes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="podium-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerButton: {
    position: 'absolute',

    left: '50%',
    marginLeft: -32,

    top: -25,

    width: 64,
    height: 64,
    borderRadius: 999,

    backgroundColor: '#22C55E',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },

  centerButtonDisabled: {
    backgroundColor: '#27272A',
    shadowOpacity: 0,
    elevation: 0,
  },
});