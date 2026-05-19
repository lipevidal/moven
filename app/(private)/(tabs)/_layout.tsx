import { Tabs } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopWidth: 0,
          height: 84,
          paddingBottom: 10,
          paddingTop: 10,
        },

        tabBarActiveTintColor:
          '#22C55E',

        tabBarInactiveTintColor:
          '#71717A',
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',

          tabBarIcon: ({
            color,
            size,
          }) => (
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

          tabBarIcon: ({
            color,
            size,
          }) => (
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
          title: 'Nova',

          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="add-circle"
              size={32}
              color="#22C55E"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="despesas"
        options={{
          title: 'Despesas',

          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="wallet-outline"
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

          tabBarIcon: ({
            color,
            size,
          }) => (
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