import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { router, usePathname } from 'expo-router';
import { getActiveSession } from '../features/workSessions/services/getActiveSession';

// Controle em memória para abrir a jornada ativa somente uma vez
// quando o app/private layout for carregado.
let hasCheckedInitialActiveSession = false;

export function InitialActiveSessionRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (hasCheckedInitialActiveSession) return;

    hasCheckedInitialActiveSession = true;
    let isMounted = true;

    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const activeSession = await getActiveSession();

        if (!isMounted || !activeSession) return;

        // Se já estiver na página da jornada ativa, não faz nada.
        if (pathname?.includes('jornada-ativa')) return;

        router.replace('/(private)/jornada-ativa' as never);
      } catch (error) {
        console.log('Erro ao verificar jornada ativa inicial:', error);
      }
    });

    return () => {
      isMounted = false;
      task.cancel?.();
    };
  }, []);

  return null;
}
