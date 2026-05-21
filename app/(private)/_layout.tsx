import { useEffect } from 'react';
import { View } from 'react-native';
import { router, Stack, useGlobalSearchParams, usePathname } from 'expo-router';

import { getActiveSession } from '../../src/features/workSessions/services/getActiveSession';
import { ActiveSessionFloatingTimer } from '../../src/components/ActiveSessionFloatingTimer';

export default function PrivateLayout() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  useEffect(() => {
    async function checkActiveSession() {
      try {
        const session = await getActiveSession();

        const alreadyInActiveScreen = pathname.includes('jornada-ativa');

        const userClosedActiveScreen =
          params.hideActiveSession === '1';

        if (
          session &&
          !alreadyInActiveScreen &&
          !userClosedActiveScreen
        ) {
          router.replace('/(private)/jornada-ativa');
        }
      } catch (error) {
        console.log(error);
      }
    }

    checkActiveSession();
  }, [pathname, params.hideActiveSession]);

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