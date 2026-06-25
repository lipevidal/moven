import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { DashboardChallengeCard } from '../../src/features/challenges/components/DashboardChallengeCard';
import { AchievementProgressCards } from '../../src/features/achievements/components/AchievementProgressCards';

export default function ChallengesAreaScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Desafios</Text>
          <Text style={styles.subtitle}>Metas, conquistas e progresso</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Ionicons name="trophy-outline" size={30} color="#FACC15" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Sua área de competição</Text>
          <Text style={styles.heroText}>
            Acompanhe desafios, conquistas, XP e evolução sem misturar com os indicadores financeiros do dashboard.
          </Text>
        </View>
      </View>

      <DashboardChallengeCard />

      <AchievementProgressCards title="Progresso dos desafios" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },

  backButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  heroCard: {
    minHeight: 110,
    borderRadius: 28,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },

  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#2A2205',
    borderWidth: 1,
    borderColor: '#713F12',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  heroText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },
});
