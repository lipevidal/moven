import { useCallback, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getChallenges } from '../../../src/features/challenges/services/getChallenges';

type ChallengeType = 'day' | 'week' | 'month';

type ChallengeCard = {
  id?: string;
  challenge_type: ChallengeType;
  status?: string;
  start_date?: string;
  end_date?: string;
};

export default function ChallengesScreen() {
  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [challenges, setChallenges] =
    useState<ChallengeCard[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, []),
  );

  async function loadChallenges() {
    try {
      setLoading(true);

      const response = await getChallenges();

      if (response.length > 0) {
        setChallenges(response as ChallengeCard[]);
      } else {
        setChallenges(getDefaultChallenges());
      }
    } catch (error) {
      console.log(error);
      setChallenges(getDefaultChallenges());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadChallenges();
  }

  function getDefaultChallenges(): ChallengeCard[] {
    return [
      {
        challenge_type: 'day',
        status: 'open',
      },
      {
        challenge_type: 'week',
        status: 'open',
      },
      {
        challenge_type: 'month',
        status: 'open',
      },
    ];
  }

  function getChallengeTitle(type: ChallengeType) {
    if (type === 'day') return 'Desafio Diário';
    if (type === 'week') return 'Desafio Semanal';

    return 'Desafio Mensal';
  }

  function getChallengeIcon(type: ChallengeType) {
    if (type === 'day') return 'today-outline';
    if (type === 'week') return 'calendar-outline';

    return 'calendar-number-outline';
  }

  function getChallengeDescription(type: ChallengeType) {
    if (type === 'day') {
      return 'Dispute com outros motoristas pelo maior faturamento do dia.';
    }

    if (type === 'week') {
      return 'Compita no acumulado semanal e suba no ranking da sua região.';
    }

    return 'Mostre consistência no mês e dispute medalhas e recordes.';
  }

  function getChallengeRule(type: ChallengeType) {
    if (type === 'day') {
      return 'Inscrição permitida até 12:00 do próprio dia.';
    }

    if (type === 'week') {
      return 'Inscrição permitida até quarta-feira da semana atual.';
    }

    return 'Inscrição permitida até o dia 15 do mês atual.';
  }

  function getChallengeColor(type: ChallengeType) {
    if (type === 'day') return '#22C55E';
    if (type === 'week') return '#3B82F6';

    return '#A855F7';
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#22C55E"
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Desafios
          </Text>

          <Text style={styles.subtitle}>
            Participe, envie comprovantes e dispute rankings com outros motoristas.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/(private)/desafios/meus-desafios')}
        >
          <Ionicons
            name="flag-outline"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoIconBox}>
          <Ionicons
            name="trophy-outline"
            size={30}
            color="#FACC15"
          />
        </View>

        <Text style={styles.infoTitle}>
          Como funciona?
        </Text>

        <Text style={styles.infoText}>
          Escolha um desafio, selecione veículo, plataformas, região e período. Depois do encerramento, envie os prints do faturamento para análise.
        </Text>

        <View style={styles.rulesList}>
          <Rule text="O ranking é baseado no faturamento aprovado." />
          <Rule text="Comprovantes precisam ser enviados no prazo." />
          <Rule text="1º, 2º e 3º colocados recebem medalhas." />
          <Rule text="Recordistas entram no Hall da Fama." />
        </View>
      </View>

      <View style={styles.shortcutsRow}>
        <TouchableOpacity
          style={styles.shortcutButton}
          onPress={() => router.push('/(private)/desafios/meus-desafios')}
        >
          <Ionicons
            name="list-outline"
            size={19}
            color="#FFFFFF"
          />

          <Text style={styles.shortcutText}>
            Meus desafios
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shortcutButton}
          onPress={() => router.push('/(private)/rankings')}
        >
          <Ionicons
            name="podium-outline"
            size={19}
            color="#FFFFFF"
          />

          <Text style={styles.shortcutText}>
            Rankings
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>
        Escolha um desafio
      </Text>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#22C55E" />
        </View>
      ) : (
        challenges.map((challenge) => {
          const type = challenge.challenge_type;
          const color = getChallengeColor(type);

          return (
            <View key={challenge.id ?? type} style={styles.challengeCard}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.challengeIconBox,
                    {
                      borderColor: color,
                      backgroundColor: `${color}22`,
                    },
                  ]}
                >
                  <Ionicons
                    name={getChallengeIcon(type)}
                    size={26}
                    color={color}
                  />
                </View>

                <View style={styles.cardInfo}>
                  <Text style={styles.challengeTitle}>
                    {getChallengeTitle(type)}
                  </Text>

                  <Text style={styles.challengeDescription}>
                    {getChallengeDescription(type)}
                  </Text>
                </View>
              </View>

              <View style={styles.ruleBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#A1A1AA"
                />

                <Text style={styles.ruleText}>
                  {getChallengeRule(type)}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.registerButton,
                  {
                    backgroundColor: color,
                  },
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/(private)/desafios/inscricao',
                    params: {
                      challengeId: challenge.id ?? '',
                      challengeType: type,
                    },
                  })
                }
              >
                <Text style={styles.registerButtonText}>
                  Inscrever-se
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <View style={styles.ruleItem}>
      <Ionicons
        name="checkmark-circle"
        size={17}
        color="#22C55E"
      />

      <Text style={styles.ruleItemText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    padding: 18,
    paddingTop: 54,
    paddingBottom: 130,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 22,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 4,
    maxWidth: 290,
  },

  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoCard: {
    backgroundColor: '#111827',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 18,
    marginBottom: 16,
  },

  infoIconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#2A2408',
    borderWidth: 1,
    borderColor: '#713F12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  infoTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },

  infoText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 8,
  },

  rulesList: {
    marginTop: 14,
    gap: 8,
  },

  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  ruleItemText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  shortcutsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },

  shortcutButton: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  shortcutText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },

  loadingBox: {
    minHeight: 180,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },

  challengeCard: {
    backgroundColor: '#111827',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },

  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },

  challengeIconBox: {
    width: 56,
    height: 56,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardInfo: {
    flex: 1,
  },

  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  challengeDescription: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 5,
  },

  ruleBox: {
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },

  ruleText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  registerButton: {
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
