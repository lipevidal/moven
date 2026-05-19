import { Tabs } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarStyle: {
          backgroundColor: '#09090B',
          borderTopWidth: 1,
          borderTopColor: '#18181B',
          height: 72,
          paddingBottom: 8,
          paddingTop: 8,
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
            <Ionicons
              name="home-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="jornadas"
        options={{
          title: 'Jornadas',

          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="time-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="nova-jornada"
        options={{
          title: '',

          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="add-circle"
              size={56}
              color={focused ? '#22C55E' : '#22C55E'}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="despesas"
        options={{
          title: 'Despesas',

          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="wallet-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="veiculos"
        options={{
          title: 'Veículos',

          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="car-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',

          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}