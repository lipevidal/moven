import { useEffect } from 'react';
import { View } from 'react-native';
import { router, Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { InitialActiveSessionRedirect } from '../../src/components/InitialActiveSessionRedirect';
import { getActiveSession } from '../../src/features/workSessions/services/getActiveSession';
import { ActiveSessionFloatingTimer } from '../../src/components/ActiveSessionFloatingTimer';

export default function PrivateLayout() {

  return (
    <View style={{ flex: 1 }}>
      <InitialActiveSessionRedirect />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="jornada-ativa" />
        <Stack.Screen name="veiculo-detalhes" />
      </Stack>

      <ActiveSessionFloatingTimer />
    </View>
  );
}