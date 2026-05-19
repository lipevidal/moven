import { Stack } from 'expo-router';

export default function PrivateLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="jornada-ativa" />
      <Stack.Screen name="veiculo-detalhes" />
    </Stack>
  );
}