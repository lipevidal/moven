import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { useEffect, useMemo, useState } from 'react';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/constants/colors';

import { getFinishedSessions } from '../../../src/features/workSessions/services/getFinishedSessions';

const filters = [
  {
    id: 'today',
    label: 'Hoje',
  },

  {
    id: '7days',
    label: '7 dias',
  },

  {
    id: '30days',
    label: '30 dias',
  },

  {
    id: '365days',
    label: '365 dias',
  },
];

export default function SessionsScreen() {
  const [sessions, setSessions] =
    useState<any[]>([]);

  const [selectedFilter, setSelectedFilter] =
    useState('today');

  const [expandedSession, setExpandedSession] =
    useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const response =
        await getFinishedSessions();

      setSessions(response);
    } catch (error) {
      console.log(error);
    }
  }

  const filteredSessions =
    useMemo(() => {
      const now = new Date();

      return sessions.filter(
        (session) => {
          const finishedAt =
            new Date(
              session.finished_at,
            );

          const diffDays =
            (now.getTime() -
              finishedAt.getTime()) /
            (1000 * 60 * 60 * 24);

          switch (
            selectedFilter
          ) {
            case 'today':
              return (
                diffDays < 1
              );

            case '7days':
              return (
                diffDays <= 7
              );

            case '30days':
              return (
                diffDays <= 30
              );

            case '365days':
              return (
                diffDays <= 365
              );

            default:
              return true;
          }
        },
      );
    }, [
      sessions,
      selectedFilter,
    ]);

  const totalRevenue =
    filteredSessions.reduce(
      (total, session) => {
        const earnings =
          session.earnings?.reduce(
            (
              sum: number,
              item: any,
            ) =>
              sum +
              Number(
                item.amount,
              ),
            0,
          ) ?? 0;

        return (
          total + earnings
        );
      },
      0,
    );

  const totalKm =
    filteredSessions.reduce(
      (total, session) => {
        const km =
          Number(
            session.end_km,
          ) -
          Number(
            session.start_km,
          );

        return total + km;
      },
      0,
    );

  const totalHours =
    filteredSessions.reduce(
      (total, session) => {
        const start =
          new Date(
            session.started_at,
          );

        const end =
          new Date(
            session.finished_at,
          );

        const diff =
          (end.getTime() -
            start.getTime()) /
          (1000 * 60 * 60);

        return total + diff;
      },
      0,
    );

  const platformTotals =
    filteredSessions.reduce(
      (
        acc: any,
        session,
      ) => {
        session.earnings?.forEach(
          (
            earning: any,
          ) => {
            acc[
              earning.platform
            ] =
              (acc[
                earning
                  .platform
              ] ?? 0) +
              Number(
                earning.amount,
              );
          },
        );

        return acc;
      },
      {},
    );

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
      <Text style={styles.title}>
        Jornadas
      </Text>

      <Text
        style={styles.subtitle}
      >
        Histórico das suas jornadas.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        style={
          styles.filtersContainer
        }
      >
        {filters.map(
          (filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterButton,

                selectedFilter ===
                  filter.id && {
                  backgroundColor:
                    '#22C55E',
                },
              ]}
              onPress={() =>
                setSelectedFilter(
                  filter.id,
                )
              }
            >
              <Text
                style={
                  styles.filterText
                }
              >
                {
                  filter.label
                }
              </Text>
            </TouchableOpacity>
          ),
        )}
      </ScrollView>

      <View
        style={
          styles.summaryCard
        }
      >
        <Text
          style={
            styles.summaryLabel
          }
        >
          Total faturado
        </Text>

        <Text
          style={
            styles.summaryValue
          }
        >
          R${' '}
          {totalRevenue.toLocaleString(
            'pt-BR',
            {
              minimumFractionDigits: 2,
            },
          )}
        </Text>

        <View
          style={
            styles.summaryRow
          }
        >
          <View>
            <Text
              style={
                styles.smallLabel
              }
            >
              Jornadas
            </Text>

            <Text
              style={
                styles.smallValue
              }
            >
              {
                filteredSessions.length
              }
            </Text>
          </View>

          <View>
            <Text
              style={
                styles.smallLabel
              }
            >
              KM
            </Text>

            <Text
              style={
                styles.smallValue
              }
            >
              {totalKm.toLocaleString(
                'pt-BR',
              )}
            </Text>
          </View>

          <View>
            <Text
              style={
                styles.smallLabel
              }
            >
              Horas
            </Text>

            <Text
              style={
                styles.smallValue
              }
            >
              {Math.floor(
                totalHours,
              )}
              h
            </Text>
          </View>
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
          platformTotals,
        ).map(
          (
            [platform, amount]: any,
          ) => {
            const percentage =
              totalRevenue > 0
                ? (amount /
                    totalRevenue) *
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

      {filteredSessions.map(
        (session) => {
          const total =
            session.earnings?.reduce(
              (
                sum: number,
                item: any,
              ) =>
                sum +
                Number(
                  item.amount,
                ),
              0,
            ) ?? 0;

          const start =
            new Date(
              session.started_at,
            );

          const end =
            new Date(
              session.finished_at,
            );

          const hours =
            (
              (end.getTime() -
                start.getTime()) /
              (1000 *
                60 *
                60)
            ).toFixed(1);

          const km =
            Number(
              session.end_km,
            ) -
            Number(
              session.start_km,
            );

          const expanded =
            expandedSession ===
            session.id;

          return (
            <TouchableOpacity
              key={session.id}
              style={
                styles.sessionCard
              }
              onPress={() =>
                setExpandedSession(
                  expanded
                    ? null
                    : session.id,
                )
              }
            >
              <View
                style={
                  styles.sessionTop
                }
              >
                <View>
                  <Text
                    style={
                      styles.sessionVehicle
                    }
                  >
                    {
                      session
                        .vehicle
                        ?.brand
                    }{' '}
                    {
                      session
                        .vehicle
                        ?.model
                    }
                  </Text>

                  <Text
                    style={
                      styles.sessionDate
                    }
                  >
                    {new Date(
                      session.finished_at,
                    ).toLocaleDateString(
                      'pt-BR',
                      {
                        weekday:
                          'short',

                        day: '2-digit',

                        month:
                          'long',

                        year: 'numeric',
                      },
                    )}
                  </Text>
                </View>

                <Text
                  style={
                    styles.sessionValue
                  }
                >
                  R${' '}
                  {total.toLocaleString(
                    'pt-BR',
                    {
                      minimumFractionDigits: 2,
                    },
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.sessionBottom
                }
              >
                <Text
                  style={
                    styles.sessionInfo
                  }
                >
                  {hours}h
                </Text>

                <Text
                  style={
                    styles.sessionInfo
                  }
                >
                  {km} km
                </Text>
              </View>

              {expanded && (
                <View
                  style={
                    styles.expandedContent
                  }
                >
                  {session.earnings?.map(
                    (
                      earning: any,
                    ) => {
                      const percentage =
                        total > 0
                          ? (Number(
                              earning.amount,
                            ) /
                              total) *
                            100
                          : 0;

                      return (
                        <View
                          key={
                            earning.id
                          }
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
                              {
                                earning.platform
                              }
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
              )}
            </TouchableOpacity>
          );
        },
      )}
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
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

    title: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '800',
    },

    subtitle: {
      color: '#71717A',
      marginTop: 6,
      marginBottom: 24,
    },

    filtersContainer: {
      marginBottom: 18,
    },

    filterButton: {
      height: 42,
      borderRadius: 14,
      backgroundColor:
        '#18181B',
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    filterText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },

    summaryCard: {
      backgroundColor:
        '#111827',
      borderRadius: 28,
      padding: 24,
      marginBottom: 18,
    },

    summaryLabel: {
      color: '#A1A1AA',
    },

    summaryValue: {
      color: '#22C55E',
      fontSize: 34,
      fontWeight: '800',
      marginTop: 8,
    },

    summaryRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      marginTop: 24,
    },

    smallLabel: {
      color: '#71717A',
      fontSize: 13,
    },

    smallValue: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '800',
      marginTop: 6,
    },

    platformCard: {
      backgroundColor:
        '#18181B',
      borderRadius: 24,
      padding: 20,
      marginBottom: 18,
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

    sessionCard: {
      backgroundColor:
        '#18181B',
      borderRadius: 24,
      padding: 18,
      marginBottom: 14,
    },

    sessionTop: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
    },

    sessionVehicle: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
    },

    sessionDate: {
      color: '#71717A',
      marginTop: 6,
      textTransform:
        'capitalize',
    },

    sessionValue: {
      color: '#22C55E',
      fontSize: 18,
      fontWeight: '800',
    },

    sessionBottom: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 20,
    },

    sessionInfo: {
      color: '#A1A1AA',
      fontWeight: '700',
    },

    expandedContent: {
      marginTop: 20,
      borderTopWidth: 1,
      borderTopColor:
        '#27272A',
      paddingTop: 20,
    },
  });