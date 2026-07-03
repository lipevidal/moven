import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/components/AuthProvider';
import { GlobalLoadingProvider } from '../src/components/GlobalLoadingProvider';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#09090B',
        }}
      >
        <GlobalLoadingProvider>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(private)" />
            </Stack>
          </AuthProvider>
        </GlobalLoadingProvider>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}