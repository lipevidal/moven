import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

        <Text style={styles.title}>MovenApp</Text>

        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#22C55E" />
          <Text style={styles.loadingText}>Carregando...</Text>
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
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    width: '82%',
    borderRadius: 32,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: 34,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 18,
  },

  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  logo: {
    width: 74,
    height: 74,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginBottom: 14,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  loadingText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '800',
  },
});