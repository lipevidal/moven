import { useCallback, useEffect, useState } from 'react';

import {
  AppState,
  AppStateStatus,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../database/supabase';
import { getActiveSession } from '../features/workSessions/services/getActiveSession';

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(Number(seconds ?? 0), 0);

  const h = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(safeSeconds % 60).padStart(2, '0');

  return `${h}:${m}:${s}`;
}

function calculateElapsedSeconds(session: any) {
  if (!session?.started_at) return 0;

  const startTime = new Date(session.started_at).getTime();
  const now = new Date().getTime();

  if (Number.isNaN(startTime)) return 0;

  const totalPausedSeconds = Number(session.total_paused_seconds ?? 0);

  let currentPauseSeconds = 0;

  if (session.status === 'paused' && session.paused_at) {
    const pausedAt = new Date(session.paused_at).getTime();

    if (!Number.isNaN(pausedAt) && now > pausedAt) {
      currentPauseSeconds = Math.floor((now - pausedAt) / 1000);
    }
  }

  const diffInSeconds = Math.floor((now - startTime) / 1000);

  const realWorkedSeconds =
    diffInSeconds - totalPausedSeconds - currentPauseSeconds;

  return realWorkedSeconds > 0 ? realWorkedSeconds : 0;
}

export function ActiveSessionFloatingTimer() {
  const pathname = usePathname();

  const [session, setSession] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const response = await getActiveSession();

      setSession(response);
      setElapsedSeconds(calculateElapsedSeconds(response));
    } catch (error) {
      console.log('Erro ao carregar card flutuante da jornada:', error);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialLoad() {
      if (!mounted) return;

      await loadSession();
    }

    initialLoad();

    const interval = setInterval(() => {
      loadSession();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [loadSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          loadSession();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [loadSession]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;

    async function startRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id || !mounted) return;

      channel = supabase
        .channel(`active-session-floating-timer-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'work_sessions',
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            await loadSession();
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'earnings',
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            await loadSession();
          },
        )
        .subscribe();
    }

    startRealtime();

    return () => {
      mounted = false;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadSession]);

  useEffect(() => {
    if (!session?.started_at) return;

    function updateTimer() {
      setElapsedSeconds(calculateElapsedSeconds(session));
    }

    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [
    session?.started_at,
    session?.status,
    session?.paused_at,
    session?.total_paused_seconds,
  ]);

  /*
    Não mostra o card dentro da própria tela da jornada ativa,
    porque lá já existe o cronômetro grande.
  */
  if (pathname.includes('jornada-ativa')) {
    return null;
  }

  if (loading) {
    return null;
  }

  if (!session) {
    return null;
  }

  const paused = session.status === 'paused';

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <TouchableOpacity
        activeOpacity={0.88}
        style={[
          styles.floatingButton,
          paused ? styles.floatingButtonPaused : styles.floatingButtonActive,
        ]}
        onPress={() => router.push('/(private)/jornada-ativa' as never)}
      >
        <View style={[styles.iconBox, paused && styles.iconBoxPaused]}>
          <Ionicons
            name={paused ? 'pause-circle-outline' : 'timer-outline'}
            size={23}
            color={paused ? '#080808' : '#F5F0E6'}
          />
        </View>

        <View style={styles.infoBox}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, paused && styles.statusDotPaused]} />

            <Text
              style={[styles.status, paused && styles.statusPaused]}
              numberOfLines={1}
            >
              {paused ? 'Jornada pausada' : 'Jornada ativa'}
            </Text>
          </View>

          <Text style={styles.timer} numberOfLines={1}>
            {formatTimer(elapsedSeconds)}
          </Text>
        </View>

        <View style={styles.chevronBox}>
          <Ionicons name="chevron-forward" size={18} color="#D4A64A" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },

  floatingButton: {
    position: 'absolute',
    right: 0,
    bottom: 116,
    minHeight: 68,
    minWidth: 210,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    backgroundColor: '#101014',
    borderColor: '#2A2830',
    shadowColor: '#D4A64A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 18,
  },

  floatingButtonActive: {
    borderColor: 'rgba(34,197,94,0.36)',
    shadowColor: '#22C55E',
  },

  floatingButtonPaused: {
    borderColor: 'rgba(250,204,21,0.42)',
    shadowColor: '#FACC15',
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBoxPaused: {
    backgroundColor: '#D4A64A',
    borderColor: '#D4A64A',
  },

  infoBox: {
    flex: 1,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },

  statusDotPaused: {
    backgroundColor: '#FACC15',
  },

  status: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  statusPaused: {
    color: '#FACC15',
  },

  timer: {
    color: '#F5F0E6',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 3,
    letterSpacing: 0.4,
  },

  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
