import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import {
  useEffect,
  useState,
} from 'react';

import { router } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/constants/colors';

import { getDashboardData } from '../../../src/features/dashboard/services/getDashboardData';

export default function DashboardScreen() {
  const [data, setData] =
    useState<any>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const response =
        await getDashboardData();

      setData(response);
    } catch (error) {
      console.log(error);
    }
  }

  if (!data) {
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
        <View>
          <Text
            style={
              styles.greeting
            }
          >
            Bem-vindo 👋
          </Text>

          <Text
            style={styles.title}
          >
            Dashboard
          </Text>
        </View>

        <TouchableOpacity
          style={
            styles.notificationButton
          }
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <View
        style={
          styles.balanceCard
        }
      >
        <Text
          style={
            styles.balanceLabel
          }
        >
          Lucro total
        </Text>

        <Text
          style={
            styles.balanceValue
          }
        >
          R${' '}
          {data.profit.toLocaleString(
            'pt-BR',
            {
              minimumFractionDigits: 2,
            },
          )}
        </Text>

        <Text
          style={
            styles.balanceGrowth
          }
        >
          {data.totalSessions}{' '}
          jornadas finalizadas
        </Text>
      </View>

      <View style={styles.grid}>
        <View
          style={
            styles.smallCard
          }
        >
          <Ionicons
            name="cash-outline"
            size={24}
            color="#22C55E"
          />

          <Text
            style={
              styles.smallCardLabel
            }
          >
            Faturamento
          </Text>

          <Text
            style={
              styles.smallCardValue
            }
          >
            R${' '}
            {data.revenue.toLocaleString(
              'pt-BR',
              {
                maximumFractionDigits: 0,
              },
            )}
          </Text>
        </View>

        <View
          style={
            styles.smallCard
          }
        >
          <Ionicons
            name="wallet-outline"
            size={24}
            color="#EF4444"
          />

          <Text
            style={
              styles.smallCardLabel
            }
          >
            Despesas
          </Text>

          <Text
            style={
              styles.smallCardValue
            }
          >
            R${' '}
            {data.expenses.toLocaleString(
              'pt-BR',
              {
                maximumFractionDigits: 0,
              },
            )}
          </Text>
        </View>

        <View
          style={
            styles.smallCard
          }
        >
          <Ionicons
            name="time-outline"
            size={24}
            color="#3B82F6"
          />

          <Text
            style={
              styles.smallCardLabel
            }
          >
            Horas
          </Text>

          <Text
            style={
              styles.smallCardValue
            }
          >
            {Math.floor(
              data.totalHours,
            )}
            h
          </Text>
        </View>

        <View
          style={
            styles.smallCard
          }
        >
          <Ionicons
            name="speedometer-outline"
            size={24}
            color="#F59E0B"
          />

          <Text
            style={
              styles.smallCardLabel
            }
          >
            KM
          </Text>

          <Text
            style={
              styles.smallCardValue
            }
          >
            {data.totalKm.toLocaleString(
              'pt-BR',
            )}
          </Text>
        </View>
      </View>

      <View
        style={
          styles.platformCard
        }
      >
        <Text
          style={
            styles.platformTitle
          }
        >
          Ganhos por plataforma
        </Text>

        {Object.entries(
          data.platformTotals,
        ).map(
          (
            [platform, amount]: any,
          ) => {
            const percentage =
              data.revenue > 0
                ? (amount /
                    data.revenue) *
                  100
                : 0;

            return (
              <View
                key={platform}
                style={
                  styles.platformItem
                }
              >
                <View
                  style={
                    styles.platformRow
                  }
                >
                  <Text
                    style={
                      styles.platformName
                    }
                  >
                    {platform}
                  </Text>

                  <Text
                    style={
                      styles.platformValue
                    }
                  >
                    {Math.round(
                      percentage,
                    )}
                    %
                  </Text>
                </View>

                <View
                  style={
                    styles.progressTrack
                  }
                >
                  <View
                    style={[
                      styles.progressFill,

                      {
                        width: `${percentage}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          },
        )}
      </View>

      <View style={styles.section}>
        <Text
          style={
            styles.sectionTitle
          }
        >
          Atalhos rápidos
        </Text>

        <View
          style={
            styles.quickActions
          }
        >
          <TouchableOpacity
            style={
              styles.quickButton
            }
            onPress={() =>
              router.push(
                '/(private)/(tabs)/nova-jornada',
              )
            }
          >
            <Ionicons
              name="add-circle-outline"
              size={22}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.quickButtonText
              }
            >
              Nova jornada
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.quickButton
            }
            onPress={() =>
              router.push(
                '/(private)/(tabs)/despesas',
              )
            }
          >
            <Ionicons
              name="wallet-outline"
              size={22}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.quickButtonText
              }
            >
              Nova despesa
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.quickButton
            }
            onPress={() =>
              router.push(
                '/(private)/(tabs)/veiculos',
              )
            }
          >
            <Ionicons
              name="car-outline"
              size={22}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.quickButtonText
              }
            >
              Veículos
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
    marginBottom: 28,
  },

  greeting: {
    color: '#A1A1AA',
    fontSize: 15,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },

  notificationButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor:
      '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  balanceCard: {
    backgroundColor:
      '#111827',
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
  },

  balanceLabel: {
    color: '#A1A1AA',
  },

  balanceValue: {
    color: '#22C55E',
    fontSize: 38,
    fontWeight: '800',
    marginTop: 8,
  },

  balanceGrowth: {
    color: '#A1A1AA',
    marginTop: 10,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent:
      'space-between',
  },

  smallCard: {
    width: '48%',
    backgroundColor:
      '#18181B',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },

  smallCardLabel: {
    color: '#A1A1AA',
    marginTop: 14,
  },

  smallCardValue: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 22,
    fontWeight: '800',
  },

  platformCard: {
    backgroundColor:
      '#18181B',
    borderRadius: 24,
    padding: 20,
    marginTop: 10,
  },

  platformTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
  },

  platformItem: {
    marginBottom: 14,
  },

  platformRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    marginBottom: 8,
  },

  platformName: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  platformValue: {
    color: '#22C55E',
    fontWeight: '800',
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor:
      '#27272A',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor:
      '#22C55E',
    borderRadius: 999,
  },

  section: {
    marginTop: 24,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },

  quickActions: {
    gap: 12,
  },

  quickButton: {
    height: 62,
    backgroundColor:
      '#18181B',
    borderRadius: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  quickButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});