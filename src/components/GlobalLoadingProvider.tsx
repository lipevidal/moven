import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * Logo carregada fora do componente.
 *
 * Isso evita executar require toda vez que o overlay renderizar.
 */
const MOVENAPP_LOGO = require('../../assets/images/movenapp-logo.png');

/**
 * Tempo mínimo do loading inicial ao abrir o app.
 *
 * Mantive os mesmos 900ms do seu código original para não alterar
 * o comportamento visual da abertura do aplicativo.
 */
const INITIAL_LOADING_TIME_MS = 900;

/**
 * Dados disponíveis no contexto global de carregamento.
 *
 * isLoading:
 * - indica se existe algum carregamento ativo.
 *
 * showLoading:
 * - aumenta o contador de carregamentos ativos.
 *
 * hideLoading:
 * - diminui o contador de carregamentos ativos.
 *
 * withLoading:
 * - executa uma função assíncrona mostrando o loading automaticamente
 *   até a função terminar.
 */
type GlobalLoadingContextData = {
  isLoading: boolean;
  showLoading: () => void;
  hideLoading: () => void;
  withLoading: <T>(callback: () => Promise<T>) => Promise<T>;
};

/**
 * Contexto global de loading.
 *
 * Ele permite que qualquer tela ou componente acesse:
 * - isLoading;
 * - showLoading;
 * - hideLoading;
 * - withLoading.
 */
const GlobalLoadingContext = createContext({} as GlobalLoadingContextData);

/**
 * Provider global de carregamento do app.
 *
 * Esse componente envolve a aplicação e controla a exibição do overlay
 * de carregamento em qualquer tela.
 *
 * A lógica usa um contador em vez de boolean simples.
 *
 * Exemplo:
 * - se duas telas chamarem showLoading, o contador vai para 2;
 * - cada hideLoading reduz 1;
 * - o overlay só some quando o contador chega em 0.
 *
 * Isso evita esconder o loading antes da hora quando existem várias
 * operações carregando ao mesmo tempo.
 */
export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  /**
   * Começa com 1 para mostrar o loading inicial ao abrir o app.
   *
   * Depois de INITIAL_LOADING_TIME_MS, esse carregamento inicial é removido.
   */
  const [loadingCount, setLoadingCount] = useState(1);

  /**
   * Remove apenas o loading inicial depois do tempo definido.
   *
   * Otimização/correção:
   * - antes o timer fazia setLoadingCount(0);
   * - isso podia esconder o loading mesmo se outra operação estivesse ativa.
   *
   * Agora ele reduz apenas 1 do contador.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingCount((current) => Math.max(current - 1, 0));
    }, INITIAL_LOADING_TIME_MS);

    return () => clearTimeout(timer);
  }, []);

  /**
   * Mostra o loading global.
   *
   * useCallback mantém a função estável entre renderizações.
   * Isso ajuda o useMemo do contexto a não recriar o value sem necessidade.
   */
  const showLoading = useCallback(() => {
    setLoadingCount((current) => current + 1);
  }, []);

  /**
   * Esconde uma ocorrência do loading global.
   *
   * Math.max impede que o contador fique negativo.
   */
  const hideLoading = useCallback(() => {
    setLoadingCount((current) => Math.max(current - 1, 0));
  }, []);

  /**
   * Executa uma função assíncrona com loading automático.
   *
   * Fluxo:
   * 1. mostra o loading;
   * 2. executa o callback;
   * 3. esconde o loading no finally, mesmo se der erro.
   */
  const withLoading = useCallback(
    async <T,>(callback: () => Promise<T>) => {
      try {
        showLoading();

        return await callback();
      } finally {
        hideLoading();
      }
    },
    [hideLoading, showLoading],
  );

  /**
   * Valor disponibilizado para os componentes filhos.
   *
   * useMemo evita recriar o objeto do contexto sem necessidade.
   */
  const value = useMemo(
    () => ({
      isLoading: loadingCount > 0,
      showLoading,
      hideLoading,
      withLoading,
    }),
    [hideLoading, loadingCount, showLoading, withLoading],
  );

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}

      {loadingCount > 0 ? <GlobalLoadingOverlay /> : null}
    </GlobalLoadingContext.Provider>
  );
}

/**
 * Hook usado para acessar o loading global em qualquer tela.
 *
 * Exemplo:
 *
 * const { withLoading } = useGlobalLoading();
 */
export function useGlobalLoading() {
  return useContext(GlobalLoadingContext);
}

/**
 * Overlay visual de carregamento.
 *
 * Ele bloqueia a interação com a tela enquanto algum carregamento
 * global estiver ativo.
 */
function GlobalLoadingOverlay() {
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <View style={styles.logoBox}>
          <Image
            source={MOVENAPP_LOGO}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.eyebrow}>MovenApp</Text>
        <Text style={styles.title}>Carregando</Text>

        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#D4A64A" />
          <Text style={styles.loadingText}>Preparando seus dados...</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Fundo escuro que cobre a tela inteira.
   *
   * zIndex/elevation altos garantem que o loading fique acima de tudo.
   */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999999,
    elevation: 999999,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  /**
   * Card central do loading.
   */
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.38)',
    borderLeftWidth: 1,
    paddingVertical: 30,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 18,
  },

  /**
   * Caixa da logo.
   */
  logoBox: {
    width: 94,
    height: 94,
    borderRadius: 18,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  /**
   * Logo do app.
   */
  logo: {
    width: 72,
    height: 72,
  },

  /**
   * Texto pequeno acima do título.
   */
  eyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: 6,
  },

  /**
   * Título principal do loading.
   */
  title: {
    color: '#F5F0E6',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 14,
  },

  /**
   * Linha com ActivityIndicator e texto.
   */
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 18,
  },

  /**
   * Texto ao lado do spinner.
   */
  loadingText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
  },

  /**
   * Fundo da barra visual de progresso.
   */
  progressTrack: {
    width: '100%',
    height: 7,
    borderRadius: 999,
    backgroundColor: '#2A2830',
    overflow: 'hidden',
  },

  /**
   * Preenchimento visual da barra.
   *
   * É uma barra estática, apenas para reforçar a sensação visual
   * de carregamento.
   */
  progressFill: {
    width: '42%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#D4A64A',
  },
});
