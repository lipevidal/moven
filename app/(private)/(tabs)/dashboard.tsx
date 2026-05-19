import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/constants/colors';

export default function DashboardScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Bem-vindo 👋
          </Text>

          <Text style={styles.title}>
            Seu resumo financeiro
          </Text>
        </View>

        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons
            name="notifications-outline"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>
          Lucro do período
        </Text>

        <Text style={styles.balanceValue}>
          R$ 2.450,00
        </Text>

        <Text style={styles.balanceGrowth}>
          +12% em relação ao período anterior
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.smallCard}>
          <Ionicons
            name="cash-outline"
            size={24}
            color={colors.primary}
          />

          <Text style={styles.smallCardLabel}>
            Faturamento
          </Text>

          <Text style={styles.smallCardValue}>
            R$ 4.800
          </Text>
        </View>

        <View style={styles.smallCard}>
          <Ionicons
            name="wallet-outline"
            size={24}
            color={colors.danger}
          />

          <Text style={styles.smallCardLabel}>
            Despesas
          </Text>

          <Text style={styles.smallCardValue}>
            R$ 2.350
          </Text>
        </View>

        <View style={styles.smallCard}>
          <Ionicons
            name="time-outline"
            size={24}
            color="#3B82F6"
          />

          <Text style={styles.smallCardLabel}>
            Horas
          </Text>

          <Text style={styles.smallCardValue}>
            182h
          </Text>
        </View>

        <View style={styles.smallCard}>
          <Ionicons
            name="speedometer-outline"
            size={24}
            color="#F59E0B"
          />

          <Text style={styles.smallCardLabel}>
            KM rodados
          </Text>

          <Text style={styles.smallCardValue}>
            4.280
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Atalhos rápidos
        </Text>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickButton}>
            <Ionicons
              name="add-circle-outline"
              size={22}
              color="#FFFFFF"
            />

            <Text style={styles.quickButtonText}>
              Nova jornada
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickButton}>
            <Ionicons
              name="wallet-outline"
              size={22}
              color="#FFFFFF"
            />

            <Text style={styles.quickButtonText}>
              Nova despesa
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickButton}>
            <Ionicons
              name="car-outline"
              size={22}
              color="#FFFFFF"
            />

            <Text style={styles.quickButtonText}>
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
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 140,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },

  greeting: {
    color: colors.textSecondary,
    fontSize: 15,
  },

  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },

  notificationButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },

  balanceLabel: {
    color: colors.textSecondary,
    fontSize: 15,
  },

  balanceValue: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '800',
    marginTop: 8,
  },

  balanceGrowth: {
    color: colors.primary,
    marginTop: 10,
    fontWeight: '700',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  smallCard: {
    width: '48%',
    backgroundColor: colors.cardSecondary,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },

  smallCardLabel: {
    color: colors.textSecondary,
    marginTop: 14,
    fontSize: 14,
  },

  smallCardValue: {
    color: colors.text,
    marginTop: 8,
    fontSize: 22,
    fontWeight: '800',
  },

  section: {
    marginTop: 18,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },

  quickActions: {
    gap: 12,
  },

  quickButton: {
    height: 62,
    backgroundColor: colors.cardSecondary,
    borderRadius: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  quickButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});