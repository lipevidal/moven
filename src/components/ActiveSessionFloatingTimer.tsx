import { useEffect, useState } from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getActiveSession } from '../features/workSessions/services/getActiveSession';

function formatTimer(seconds: number) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');

  return `${h}:${m}:${s}`;
}

export function ActiveSessionFloatingTimer() {
  const pathname = usePathname();

  const [session, setSession] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const response = await getActiveSession();

      if (!mounted) return;

      setSession(response);
    }

    loadSession();

    const interval = setInterval(loadSession, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!session?.started_at) return;

    function updateTimer() {
      const startTime = new Date(session.started_at).getTime();
      const now = new Date().getTime();

      const totalPausedSeconds = Number(session.total_paused_seconds ?? 0);

      let currentPauseSeconds = 0;

      if (session.status === 'paused' && session.paused_at) {
        currentPauseSeconds = Math.floor(
          (now - new Date(session.paused_at).getTime()) / 1000,
        );
      }

      const diffInSeconds = Math.floor((now - startTime) / 1000);

      const realWorkedSeconds =
        diffInSeconds - totalPausedSeconds - currentPauseSeconds;

      setElapsedSeconds(realWorkedSeconds > 0 ? realWorkedSeconds : 0);
    }

    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [
    session?.started_at,
    session?.status,
    session?.paused_at,
    session?.total_paused_seconds,
  ]);

  if (!session) return null;

  if (pathname.includes('jornada-ativa')) {
    return null;
  }

  const paused = session.status === 'paused';

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <TouchableOpacity
        style={[
          styles.floatingButton,
          paused ? styles.floatingButtonPaused : styles.floatingButtonActive,
        ]}
        activeOpacity={0.88}
        onPress={() => router.push('/(private)/jornada-ativa')}
      >
        <View style={[styles.iconBox, paused && styles.iconBoxPaused]}>
          <Ionicons
            name={paused ? 'pause-circle-outline' : 'timer-outline'}
            size={23}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.infoBox}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, paused && styles.statusDotPaused]} />

            <Text style={styles.status} numberOfLines={1}>
              {paused ? 'Jornada pausada' : 'Jornada ativa'}
            </Text>
          </View>

          <Text style={styles.timer} numberOfLines={1}>
            {formatTimer(elapsedSeconds)}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color="rgba(255,255,255,0.75)"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },

  floatingButton: {
    position: 'absolute',
    right: 0,
    bottom: 96,
    minHeight: 68,
    minWidth: 210,
    borderTopLeftRadius: 26,
    borderBottomLeftRadius: 26,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },

  floatingButtonActive: {
    backgroundColor: '#052E16',
    borderColor: '#166534',
    shadowColor: '#22C55E',
  },

  floatingButtonPaused: {
    backgroundColor: '#2A1605',
    borderColor: '#B45309',
    shadowColor: '#F59E0B',
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBoxPaused: {
    backgroundColor: '#F59E0B',
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
    backgroundColor: '#F59E0B',
  },

  status: {
    color: '#DCFCE7',
    fontSize: 11,
    fontWeight: '900',
  },

  timer: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 3,
    letterSpacing: 0.4,
  },
});
