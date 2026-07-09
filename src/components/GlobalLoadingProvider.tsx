import {
  createContext,
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

type GlobalLoadingContextData = {
  isLoading: boolean;
  showLoading: () => void;
  hideLoading: () => void;
  withLoading: <T>(callback: () => Promise<T>) => Promise<T>;
};

const GlobalLoadingContext = createContext({} as GlobalLoadingContextData);

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const [loadingCount, setLoadingCount] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingCount(0);
    }, 900);

    return () => clearTimeout(timer);
  }, []);

  function showLoading() {
    setLoadingCount((current) => current + 1);
  }

  function hideLoading() {
    setLoadingCount((current) => Math.max(current - 1, 0));
  }

  async function withLoading<T>(callback: () => Promise<T>) {
    try {
      showLoading();

      return await callback();
    } finally {
      hideLoading();
    }
  }

  const value = useMemo(
    () => ({
      isLoading: loadingCount > 0,
      showLoading,
      hideLoading,
      withLoading,
    }),
    [loadingCount],
  );

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}

      {loadingCount > 0 ? <GlobalLoadingOverlay /> : null}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  return useContext(GlobalLoadingContext);
}

function GlobalLoadingOverlay() {
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <View style={styles.logoBox}>
          <Image
            source={require('../../assets/images/movenapp-logo.png')}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999999,
    elevation: 999999,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.38)',
    borderLeftWidth: 1,
    //borderLeftColor: '#D4A64A',
    paddingVertical: 30,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.10,
    shadowRadius: 26,
    elevation: 18,
  },

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

  logo: {
    width: 72,
    height: 72,
  },

  eyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: 6,
  },

  title: {
    color: '#F5F0E6',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 14,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 18,
  },

  loadingText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
  },

  progressTrack: {
    width: '100%',
    height: 7,
    borderRadius: 999,
    backgroundColor: '#2A2830',
    overflow: 'hidden',
  },

  progressFill: {
    width: '42%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#D4A64A',
  },
});
