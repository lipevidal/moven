/**
 * Polyfill necessário para o Supabase funcionar corretamente no React Native.
 *
 * O Supabase usa APIs de URL que existem naturalmente no navegador,
 * mas nem sempre estão disponíveis no ambiente React Native.
 *
 * Por isso, este import deve ficar no topo do arquivo.
 */
import 'react-native-url-polyfill/auto';

/**
 * AsyncStorage é usado para salvar a sessão do usuário no dispositivo.
 *
 * Com ele, o usuário não precisa fazer login toda vez que abrir o app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * createClient cria a conexão principal com o Supabase.
 *
 * A partir desse client, o app acessa:
 * - autenticação
 * - banco de dados
 * - storage
 * - funções RPC
 * - realtime
 */
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente global do Supabase usado em todo o app.
 *
 * As variáveis abaixo vêm do arquivo .env:
 *
 * EXPO_PUBLIC_SUPABASE_URL
 * EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Importante:
 * - O prefixo EXPO_PUBLIC_ permite que o Expo exponha essas variáveis no app.
 * - A anon key pode ficar no app, desde que as regras de segurança do Supabase
 *   estejam protegidas com RLS/policies.
 */
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      /**
       * Define onde a sessão será salva no React Native.
       *
       * No navegador o Supabase usa localStorage.
       * No React Native usamos AsyncStorage.
       */
      storage: AsyncStorage,

      /**
       * Renova o token automaticamente antes de expirar.
       *
       * Isso ajuda o usuário a continuar logado sem precisar entrar novamente.
       */
      autoRefreshToken: true,

      /**
       * Mantém a sessão salva no dispositivo.
       *
       * Se estiver true:
       * - o usuário fecha o app
       * - abre novamente
       * - o Supabase tenta recuperar a sessão salva
       */
      persistSession: true,

      /**
       * No React Native/Expo geralmente deixamos false.
       *
       * Essa opção é mais usada em apps web, onde o Supabase detecta tokens
       * diretamente na URL após redirects de autenticação.
       *
       * Como o app usa deep links/Expo Router, manter false evita comportamentos
       * inesperados ao abrir o app.
       */
      detectSessionInUrl: false,
    },
  },
);
