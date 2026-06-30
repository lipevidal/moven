import { useEffect, useState } from 'react';
import { DeviceEventEmitter, View } from 'react-native';
import { Stack } from 'expo-router';

import { InitialActiveSessionRedirect } from '../../src/components/InitialActiveSessionRedirect';
import { ActiveSessionFloatingTimer } from '../../src/components/ActiveSessionFloatingTimer';
import { ActiveSessionCityChatFloatingButton } from '../../src/components/ActiveSessionCityChatFloatingButton';

export default function PrivateLayout() {
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'movenapp:quick-actions-visible',
      (visible) => {
        setQuickActionsVisible(Boolean(visible));
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  /*
    IMPORTANTE:
    Não usamos mais hideActiveSession vindo por parâmetro da rota.

    O problema era este:
    - A tela jornada-ativa voltava para o Dashboard enviando hideActiveSession=1.
    - O layout privado lia esse parâmetro global.
    - Então o card flutuante ficava escondido justamente quando deveria aparecer.

    Agora quem decide se o card deve sumir é o próprio ActiveSessionFloatingTimer,
    olhando a rota atual. Se estiver em jornada-ativa, ele não aparece.
    Em qualquer outra tela, se existir jornada ativa/pausada, ele aparece.
  */
  const shouldHideFloatingTimer = quickActionsVisible;

  return (
    <View style={{ flex: 1 }}>
      <InitialActiveSessionRedirect />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="jornada-ativa" />
        <Stack.Screen name="veiculo-detalhes" />
      </Stack>

      {!shouldHideFloatingTimer && <ActiveSessionFloatingTimer /> }
      <ActiveSessionCityChatFloatingButton />
    </View>
  );
}