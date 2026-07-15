import { useEffect } from 'react';

import { router } from 'expo-router';

import { supabase } from '../database/supabase';

import { useAuthStore } from '../store/authStore';

/**
 * AuthProvider
 *
 * Responsabilidade deste arquivo:
 * - Manter o usuário do Supabase sincronizado com a store global do app.
 * - Reagir a login e logout.
 * - Evitar redirecionamento duplicado durante a abertura inicial do app.
 *
 * Importante:
 * - A primeira decisão de rota fica no app/index.tsx.
 * - O app/index.tsx mostra a tela de carregamento e decide:
 *   - usuário logado -> dashboard
 *   - usuário deslogado -> login
 *
 * Por isso, este AuthProvider não precisa mais chamar getSession ao iniciar.
 * Isso deixa o carregamento mais rápido e evita conflito de navegação.
 */
export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  /**
   * setUser atualiza a store global de autenticação.
   *
   * Outras telas podem usar essa store para saber quem é o usuário atual,
   * sem precisar consultar o Supabase repetidamente.
   */
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    /**
     * onAuthStateChange escuta mudanças de autenticação do Supabase.
     *
     * Eventos comuns:
     * - INITIAL_SESSION: sessão inicial carregada pelo Supabase.
     * - SIGNED_IN: usuário acabou de entrar.
     * - SIGNED_OUT: usuário saiu.
     * - TOKEN_REFRESHED: token renovado.
     * - USER_UPDATED: usuário atualizado.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;

      /**
       * INITIAL_SESSION acontece quando o Supabase recupera a sessão salva.
       *
       * Aqui apenas sincronizamos a store.
       * Não redirecionamos, porque quem decide a primeira rota é o app/index.tsx.
       *
       * Isso evita:
       * - login aparecer antes do dashboard
       * - dois arquivos tentando navegar ao mesmo tempo
       * - processamento duplicado na abertura do app
       */
      if (event === 'INITIAL_SESSION') {
        if (user) {
          setUser({
            id: user.id,
            email: user.email ?? '',
          });
        } else {
          setUser(null);
        }

        return;
      }

      /**
       * Quando o usuário faz login, atualizamos a store e enviamos para o dashboard.
       *
       * Mesmo que a tela de login também chame router.replace, manter isso aqui
       * garante que qualquer login feito em outro lugar do app também funcione.
       */
      if (event === 'SIGNED_IN' && user) {
        setUser({
          id: user.id,
          email: user.email ?? '',
        });

        router.replace('/(private)/(tabs)/dashboard' as never);
        return;
      }

      /**
       * Quando o token é renovado ou o usuário é atualizado,
       * apenas mantemos a store sincronizada.
       *
       * Não redirecionamos para não atrapalhar a tela atual.
       */
      if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && user) {
        setUser({
          id: user.id,
          email: user.email ?? '',
        });

        return;
      }

      /**
       * Quando o usuário sai ou a sessão deixa de existir,
       * limpamos a store e enviamos para o login.
       */
      if (event === 'SIGNED_OUT' || !user) {
        setUser(null);
        router.replace('/(auth)/login' as never);
      }
    });

    /**
     * Remove o listener quando o provider desmontar.
     *
     * Isso evita múltiplos listeners ativos e vazamento de memória.
     */
    return () => {
      subscription.unsubscribe();
    };
  }, [setUser]);

  /**
   * O AuthProvider não cria tela visual.
   * Ele apenas envolve as rotas e mantém a autenticação sincronizada.
   */
  return children;
}
