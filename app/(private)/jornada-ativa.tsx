import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';

import { useEffect, useState } from 'react';

import { router } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../src/constants/colors';

import { getActiveSession } from '../../src/features/workSessions/services/getActiveSession';

import { finishWorkSession } from '../../src/features/workSessions/services/finishWorkSession';

const platforms = [
  'Uber',
  '99',
  'Particular',
  'Produtos',
];

export default function ActiveSessionScreen() {
  const [session, setSession] =
    useState<any>(null);

  const [elapsedTime, setElapsedTime] =
    useState('00:00:00');

  const [endKm, setEndKm] =
    useState('');

  const [earnings, setEarnings] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const interval = setInterval(() => {
      updateTimer();
    }, 1000);

    return () =>
      clearInterval(interval);
  }, [session]);

  async function loadSession() {
    try {
      const response =
        await getActiveSession();

      if (!response) {
        router.back();

        return;
      }

      setSession(response);

      setEndKm(
        String(
          response.start_km,
        ),
      );
    } catch (error) {
      console.log(error);
    }
  }

  function updateTimer() {
    if (!session) {
      return;
    }

    const startDate = new Date(
      session.started_at,
    );

    const now = new Date();

    const diff =
      now.getTime() -
      startDate.getTime();

    const totalSeconds =
      Math.floor(diff / 1000);

    const hours = String(
      Math.floor(
        totalSeconds / 3600,
      ),
    ).padStart(2, '0');

    const minutes = String(
      Math.floor(
        (totalSeconds % 3600) /
          60,
      ),
    ).padStart(2, '0');

    const seconds = String(
      totalSeconds % 60,
    ).padStart(2, '0');

    setElapsedTime(
      `${hours}:${minutes}:${seconds}`,
    );
  }

  function handleChangeEarning(
    platform: string,
    value: string,
  ) {
    const numericValue =
      Number(value) || 0;

    const alreadyExists =
      earnings.find(
        (item) =>
          item.platform ===
          platform,
      );

    if (alreadyExists) {
      setEarnings((old) =>
        old.map((item) =>
          item.platform ===
          platform
            ? {
                ...item,
                amount:
                  numericValue,
              }
            : item,
        ),
      );

      return;
    }

    setEarnings((old) => [
      ...old,

      {
        platform,

        amount: numericValue,
      },
    ]);
  }

  function getPlatformValue(
    platform: string,
  ) {
    const earning =
      earnings.find(
        (item) =>
          item.platform ===
          platform,
      );

    return earning
      ? String(earning.amount)
      : '';
  }

  const totalEarnings =
    earnings.reduce(
      (total, item) =>
        total + item.amount,
      0,
    );

  async function handleFinish() {
    try {
      if (!endKm) {
        Alert.alert(
          'Atenção',
          'Informe o KM final.',
        );

        return;
      }

      setLoading(true);

      await finishWorkSession({
        session_id: session.id,

        end_km:
          Number(endKm),

        earnings,
      });

      Alert.alert(
        'Jornada finalizada',
      );

      router.replace(
        '/(private)/(tabs)/dashboard',
      );
    } catch (error) {
      console.log(error);

      Alert.alert(
        'Erro',
        'Não foi possível finalizar a jornada.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return null;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          Jornada ativa
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="close"
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.timerCard}>
        <Text
          style={
            styles.timerLabel
          }
        >
          Tempo trabalhado
        </Text>

        <Text
          style={
            styles.timerValue
          }
        >
          {elapsedTime}
        </Text>
      </View>

      <View
        style={
          styles.vehicleCard
        }
      >
        <View
          style={
            styles.vehicleIcon
          }
        >
          <Ionicons
            name="car-outline"
            size={28}
            color="#22C55E"
          />
        </View>

        <View>
          <Text
            style={
              styles.vehicleTitle
            }
          >
            {
              session.vehicle
                ?.brand
            }{' '}
            {
              session.vehicle
                ?.model
            }
          </Text>

          <Text
            style={
              styles.vehiclePlate
            }
          >
            {
              session.vehicle
                ?.plate
            }
          </Text>
        </View>
      </View>

      <View
        style={
          styles.kmContainer
        }
      >
        <View
          style={
            styles.kmCard
          }
        >
          <Text
            style={
              styles.kmLabel
            }
          >
            KM inicial
          </Text>

          <Text
            style={
              styles.kmValue
            }
          >
            {Number(
              session.start_km,
            ).toLocaleString(
              'pt-BR',
            )}
          </Text>
        </View>

        <View
          style={
            styles.kmCard
          }
        >
          <Text
            style={
              styles.kmLabel
            }
          >
            KM final
          </Text>

          <TextInput
            value={endKm}
            onChangeText={
              setEndKm
            }
            keyboardType="numeric"
            style={
              styles.kmInput
            }
            placeholder="0"
            placeholderTextColor="#71717A"
          />
        </View>
      </View>

      <Text
        style={
          styles.sectionTitle
        }
      >
        Ganhos
      </Text>

      {platforms.map(
        (platform) => (
          <View
            key={platform}
            style={
              styles.earningCard
            }
          >
            <Text
              style={
                styles.earningTitle
              }
            >
              {platform}
            </Text>

            <TextInput
              value={getPlatformValue(
                platform,
              )}
              onChangeText={(
                value,
              ) =>
                handleChangeEarning(
                  platform,
                  value,
                )
              }
              keyboardType="numeric"
              placeholder="0,00"
              placeholderTextColor="#71717A"
              style={
                styles.earningInput
              }
            />
          </View>
        ),
      )}

      <View
        style={
          styles.totalCard
        }
      >
        <Text
          style={
            styles.totalLabel
          }
        >
          Total faturado
        </Text>

        <Text
          style={
            styles.totalValue
          }
        >
          R${' '}
          {totalEarnings.toLocaleString(
            'pt-BR',
            {
              minimumFractionDigits: 2,
            },
          )}
        </Text>
      </View>

      <TouchableOpacity
        style={
          styles.finishButton
        }
        onPress={
          handleFinish
        }
        disabled={loading}
      >
        <Text
          style={
            styles.finishButtonText
          }
        >
          {loading
            ? 'Finalizando...'
            : 'Finalizar jornada'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 140,
  },

  header: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginBottom: 26,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  timerCard: {
    backgroundColor:
      '#111827',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },

  timerLabel: {
    color: '#A1A1AA',
    marginBottom: 12,
  },

  timerValue: {
    color: '#22C55E',
    fontSize: 42,
    fontWeight: '800',
  },

  vehicleCard: {
    backgroundColor:
      '#18181B',
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  vehicleIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor:
      '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  vehicleTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  vehiclePlate: {
    color: '#71717A',
    marginTop: 4,
  },

  kmContainer: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    marginBottom: 24,
  },

  kmCard: {
    width: '48%',
    backgroundColor:
      '#18181B',
    borderRadius: 22,
    padding: 18,
  },

  kmLabel: {
    color: '#71717A',
    marginBottom: 12,
  },

  kmValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  kmInput: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    padding: 0,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },

  earningCard: {
    backgroundColor:
      '#18181B',
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
  },

  earningTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },

  earningInput: {
    height: 54,
    borderRadius: 16,
    backgroundColor:
      '#111827',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },

  totalCard: {
    backgroundColor:
      '#111827',
    borderRadius: 26,
    padding: 24,
    marginTop: 18,
    marginBottom: 24,
  },

  totalLabel: {
    color: '#A1A1AA',
  },

  totalValue: {
    color: '#22C55E',
    fontSize: 34,
    fontWeight: '800',
    marginTop: 10,
  },

  finishButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor:
      '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});