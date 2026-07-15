import { useEffect } from 'react';

import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { supabase } from '../src/database/supabase';

type InitialRoute = '/(private)/(tabs)/dashboard' | '/(auth)/login';

/**
 * Logo usada na tela de carregamento inicial.
 *
 * Fica fora do componente para evitar recriar o require em cada render.
 */
const LOGO_SOURCE = require('../assets/images/movenapp-logo.png');

/**
 * Index
 *
 * Responsabilidade deste arquivo:
 * - Ser a primeira tela aberta pelo app.
 * - Mostrar somente a tela de carregamento padrão.
 * - Verificar se existe sessão ativa no Supabase.
 * - Enviar o usuário para a rota correta somente depois da verificação.
 *
 * Resultado:
 * - Se estiver logado, vai direto para o dashboard.
 * - Se estiver deslogado, vai para o login.
 * - Evita aparecer login rapidamente antes do dashboard.
 */
export default function Index() {
  useEffect(() => {
    let isMounted = true;

    async function resolveInitialRoute() {
      try {
        /**
         * getSession consulta a sessão persistida localmente pelo Supabase.
         * Normalmente é rápido e evita precisar abrir a tela de login antes.
         */
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.log('Erro ao verificar sessão inicial:', error);
        }

        const hasSession = Boolean(data.session?.user?.id);

        const nextRoute: InitialRoute = hasSession
          ? '/(private)/(tabs)/dashboard'
          : '/(auth)/login';

        if (!isMounted) return;

        /**
         * Redireciona apenas depois de terminar a verificação.
         *
         * Não usamos delay artificial aqui para deixar o carregamento mais rápido.
         */
        router.replace(nextRoute as never);
      } catch (error) {
        console.log('Erro ao resolver rota inicial:', error);

        if (!isMounted) return;

        /**
         * Em caso de falha, por segurança, mandamos para o login.
         */
        router.replace('/(auth)/login' as never);
      }
    }

    resolveInitialRoute();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image
          source={LOGO_SOURCE}
          style={styles.logo}
          resizeMode="contain"
        />

        <ActivityIndicator color="#D4A64A" size="small" />

        <Text style={styles.title}>MovenApp</Text>

        <Text style={styles.message}>Preparando seu acesso...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 22,
    paddingVertical: 28,
    alignItems: 'center',
  },

  logo: {
    width: 176,
    height: 86,
    marginBottom: 18,
  },

  title: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
  },

  message: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
});
