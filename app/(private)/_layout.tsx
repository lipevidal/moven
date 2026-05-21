import { useEffect } from 'react';

import { View } from 'react-native';

import { router, Stack, usePathname } from 'expo-router';

import { getActiveSession } from '../../src/features/workSessions/services/getActiveSession';

import { ActiveSessionFloatingTimer } from '../../src/components/ActiveSessionFloatingTimer';

export default function PrivateLayout() {
  const pathname = usePathname();

  useEffect(() => {
    async function checkActiveSession() {
      try {
        const session = await getActiveSession();

        const alreadyInActiveScreen = pathname.includes('jornada-ativa');

        if (session && !alreadyInActiveScreen) {
          router.replace('/(private)/jornada-ativa');
        }
      } catch (error) {
        console.log(error);
      }
    }

    checkActiveSession();
  }, [pathname]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="jornada-ativa" />

        <Stack.Screen name="veiculo-detalhes" />
      </Stack>

      <ActiveSessionFloatingTimer />
    </View>
  );
}