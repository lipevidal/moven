import { useEffect, useState } from 'react';

import {
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { router, usePathname } from 'expo-router';

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
    async function loadSession() {
      const response = await getActiveSession();
      setSession(response);
    }

    loadSession();

    const interval = setInterval(loadSession, 5000);

    return () => clearInterval(interval);
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

  return (
    <TouchableOpacity
      style={[
        styles.floatingButton,
        session.status === 'paused' && {
          backgroundColor: '#F59E0B',
        },
      ]}
      activeOpacity={0.85}
      onPress={() => router.push('/(private)/jornada-ativa')}
    >
      <Text style={styles.status}>
        {session.status === 'paused' ? 'Pausada' : 'Ativa'}
      </Text>

      <Text style={styles.timer}>
        {formatTimer(elapsedSeconds)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 18,
    bottom: 96,
    backgroundColor: '#22C55E',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    zIndex: 999,
    elevation: 999,
  },

  status: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },

  timer: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
});