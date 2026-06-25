import { useCallback, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { isAdmin } from '../../../src/features/admin/services/isAdmin';

type AdminCardProps = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

export default function AdminHomeScreen() {
  const [loading, setLoading] =
    useState(true);

  const [allowed, setAllowed] =
    useState(false);

  useFocusEffect(
    useCallback(() => {
      checkPermission();
    }, []),
  );

  async function checkPermission() {
    try {
      setLoading(true);

      const response = await isAdmin();

      setAllowed(response);
    } catch (error) {
      console.log(error);
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }

  const cards: AdminCardProps[] = [
    {
      title: 'Análise de comprovantes',
      description: 'Aprove, corrija ou reprove envios dos participantes.',
      icon: 'images-outline',
      color: '#3B82F6',
      route: '/(private)/admin/proofs',
    },
    {
      title: 'Gerar rankings',
      description: 'Gere rankings, medalhas, troféus, XP e notificações.',
      icon: 'podium-outline',
      color: '#22C55E',
      route: '/(private)/admin/rankings',
    },
    {
      title: 'Rankings públicos',
      description: 'Visualize os rankings como os usuários enxergam.',
      icon: 'stats-chart-outline',
      color: '#A855F7',
      route: '/(private)/rankings',
    },
    {
      title: 'Hall da fama',
      description: 'Veja os maiores faturamentos históricos do app.',
      icon: 'trophy-outline',
      color: '#FACC15',
      route: '/(private)/hall-of-fame',
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  if (!allowed) {
    return (
      <View style={styles.notAllowedPage}>
        <View style={styles.lockIconBox}>
          <Ionicons
            name="lock-closed-outline"
            size={42}
            color="#EF4444"
          />
        </View>

        <Text style={styles.notAllowedTitle}>
          Acesso restrito
        </Text>

        <Text style={styles.notAllowedText}>
          Apenas administradores podem acessar esta área.
        </Text>

        <TouchableOpacity
          style={styles.backButtonLarge}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonLargeText}>
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Admin
          </Text>

          <Text style={styles.subtitle}>
            Painel administrativo dos desafios e rankings.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="close"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIconBox}>
          <Ionicons
            name="shield-checkmark-outline"
            size={34}
            color="#22C55E"
          />
        </View>

        <Text style={styles.heroTitle}>
          Central de controle
        </Text>

        <Text style={styles.heroText}>
          Gerencie comprovantes, rankings, medalhas, XP, recordistas e notificações dos usuários.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Ferramentas
      </Text>

      {cards.map((card) => (
        <TouchableOpacity
          key={card.route}
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push(card.route as any)}
        >
          <View
            style={[
              styles.cardIconBox,
              {
                borderColor: card.color,
                backgroundColor: `${card.color}22`,
              },
            ]}
          >
            <Ionicons
              name={card.icon}
              size={24}
              color={card.color}
            />
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>
              {card.title}
            </Text>

            <Text style={styles.cardDescription}>
              {card.description}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={22}
            color="#71717A"
          />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingPage: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  notAllowedPage: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  lockIconBox: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: '#2A0A0A',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  notAllowedTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },

  notAllowedText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },

  backButtonLarge: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
  },

  backButtonLargeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

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
    alignItems: 'center',
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
    marginTop: 4,
    maxWidth: 280,
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

  heroCard: {
    backgroundColor: '#052E16',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#166534',
    padding: 20,
    marginBottom: 22,
  },

  heroIconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },

  heroText: {
    color: '#BBF7D0',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 8,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },

  card: {
    minHeight: 88,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cardInfo: {
    flex: 1,
  },

  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  cardDescription: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
});
