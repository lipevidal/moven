import { Stack } from 'expo-router';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/components/AuthProvider';
import { GlobalLoadingProvider } from '../src/components/GlobalLoadingProvider';

/**
 * RootLayout
 *
 * Responsabilidade deste arquivo:
 * - Montar a estrutura principal do app.
 * - Envolver o app com providers globais.
 * - Registrar os grupos de rotas do Expo Router.
 *
 * Este arquivo não deve decidir se o usuário vai para login ou dashboard.
 * Essa decisão fica no app/index.tsx.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#09090B',
        }}
      >
        {/* Provider global de loading do app. */}
        <GlobalLoadingProvider>
          {/* Provider que sincroniza autenticação e reage a login/logout. */}
          <AuthProvider>
            {/* Stack principal do Expo Router. */}
            <Stack screenOptions={{ headerShown: false }}>
              {/* Primeira tela aberta: mostra loading e decide login/dashboard. */}
              <Stack.Screen name="index" />

              {/* Grupo de telas públicas: login, cadastro e recuperação de senha. */}
              <Stack.Screen name="(auth)" />

              {/* Grupo de telas privadas: dashboard, tabs e demais áreas logadas. */}
              <Stack.Screen name="(private)" />
            </Stack>
          </AuthProvider>
        </GlobalLoadingProvider>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
