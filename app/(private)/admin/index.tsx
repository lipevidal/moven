import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getCurrentUserIsAdmin } from '../../../src/features/admin/services/adminAccess';
import {
  AdminCity,
  AdminStatusFilter,
  AdminUser,
  getAdminCities,
  getAdminUserDisplayName,
  getAdminUsers,
  isActiveAdminUser,
  isInactiveAdminUser,
  isNewAdminUser,
} from '../../../src/features/admin/services/adminDashboard';

const statusTabs: { id: AdminStatusFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'Todos usuários', icon: 'people-outline' },
  { id: 'new', label: 'Novos usuários', icon: 'sparkles-outline' },
  { id: 'active', label: 'Usuários ativos', icon: 'checkmark-circle-outline' },
  { id: 'inactive', label: 'Usuários inativos', icon: 'close-circle-outline' },
];

const viewTabs: { id: 'cities' | 'users'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'cities', label: 'Cidades', icon: 'location-outline' },
  { id: 'users', label: 'Usuários', icon: 'person-outline' },
];

function formatDate(value?: string | null) {
  if (!value) return '--/--/----';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '--/--/----';

  return date.toLocaleDateString('pt-BR');
}

function getUserStatusInfo(user: AdminUser) {
  if (isInactiveAdminUser(user)) {
    return {
      label: 'Inativo',
      color: '#F87171',
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderColor: 'rgba(239,68,68,0.24)',
    };
  }

  if (isActiveAdminUser(user)) {
    return {
      label: 'Ativo',
      color: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.24)',
    };
  }

  return {
    label: 'Sem status',
    color: '#A1A1AA',
    backgroundColor: 'rgba(161,161,170,0.10)',
    borderColor: 'rgba(161,161,170,0.20)',
  };
}

function getUserDueDateInfo(user: AdminUser) {
  const dueDateValue = user.subscription_due_at;

  if (!dueDateValue) {
    return {
      label: 'Sem vencimento',
      color: '#A1A1AA',
      icon: 'calendar-outline' as const,
    };
  }

  const dueDate = new Date(dueDateValue);

  if (Number.isNaN(dueDate.getTime())) {
    return {
      label: 'Vencimento inválido',
      color: '#A1A1AA',
      icon: 'calendar-outline' as const,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedDueDate = new Date(dueDate);
  normalizedDueDate.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (normalizedDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) {
    return {
      label: `Venceu em ${formatDate(dueDateValue)}`,
      color: '#F87171',
      icon: 'alert-circle-outline' as const,
    };
  }

  if (diffDays === 0) {
    return {
      label: 'Vence hoje',
      color: '#FACC15',
      icon: 'time-outline' as const,
    };
  }

  if (diffDays === 1) {
    return {
      label: 'Vence amanhã',
      color: '#FACC15',
      icon: 'time-outline' as const,
    };
  }

  return {
    label: `Vence em ${diffDays} dias`,
    color: '#22C55E',
    icon: 'calendar-outline' as const,
  };
}

export default function AdminHomeScreen() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>('all');
  const [viewMode, setViewMode] = useState<'cities' | 'users'>('cities');
  const [citySearch, setCitySearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  async function validateAdminAccess() {
    try {
      setCheckingAccess(true);

      const response = await getCurrentUserIsAdmin();

      setIsAdmin(response);

      if (!response) {
        Alert.alert('Acesso negado', 'Essa área é permitida somente para administradores.');
        router.replace('/(private)/(tabs)/dashboard' as never);
      }
    } catch (error) {
      console.log('Erro ao validar admin:', error);
      setIsAdmin(false);
      router.replace('/(private)/(tabs)/dashboard' as never);
    } finally {
      setCheckingAccess(false);
    }
  }

  async function loadAdminData(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [citiesResponse, usersResponse] = await Promise.all([
        getAdminCities({ statusFilter, search: citySearch }),
        getAdminUsers({ statusFilter, search: userSearch }),
      ]);

      setCities(citiesResponse);
      setUsers(usersResponse);
    } catch (error: any) {
      console.log('Erro ao carregar admin:', error);

      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível carregar os dados administrativos.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    validateAdminAccess();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        loadAdminData();
      }
    }, [isAdmin, statusFilter]),
  );

  useEffect(() => {
    if (!isAdmin) return;

    const timeout = setTimeout(() => {
      loadAdminData();
    }, 350);

    return () => clearTimeout(timeout);
  }, [isAdmin, citySearch, userSearch, statusFilter]);

  const summary = useMemo(() => {
    const active = users.filter(isActiveAdminUser).length;
    const inactive = users.filter(isInactiveAdminUser).length;
    const newest = users.filter(isNewAdminUser).length;

    return {
      total: users.length,
      active,
      inactive,
      newest,
    };
  }, [users]);

  function openCityUsers(city: AdminCity) {
    router.push({
      pathname: '/(private)/admin/cidade-usuarios',
      params: {
        cityId: city.id,
        cityName: city.name,
        uf: city.uf,
        statusFilter,
      },
    } as never);
  }

  if (checkingAccess || !isAdmin) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#22C55E" />
        <Text style={styles.loadingText}>Verificando acesso...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          tintColor="#22C55E"
          refreshing={refreshing}
          onRefresh={() => loadAdminData(true)}
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.headerIconButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerEyebrow}>Painel do sistema</Text>
          <Text style={styles.headerTitle}>Administração</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.configButton}
          onPress={() => router.push('/(private)/admin/configuracoes' as never)}
        >
          <Ionicons name="settings-outline" size={22} color="#22C55E" />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Total" value={summary.total} icon="people-outline" color="#60A5FA" />
        <SummaryCard label="Novos" value={summary.newest} icon="sparkles-outline" color="#FACC15" />
        <SummaryCard label="Ativos" value={summary.active} icon="checkmark-circle-outline" color="#22C55E" />
        <SummaryCard label="Inativos" value={summary.inactive} icon="close-circle-outline" color="#F87171" />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusTabs}
      >
        {statusTabs.map((item) => {
          const selected = statusFilter === item.id;

          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              style={[styles.statusTab, selected && styles.statusTabActive]}
              onPress={() => setStatusFilter(item.id)}
            >
              <Ionicons
                name={item.icon}
                size={17}
                color={selected ? '#06130B' : '#A1A1AA'}
              />
              <Text style={[styles.statusTabText, selected && styles.statusTabTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.viewTabsContainer}>
        {viewTabs.map((item) => {
          const selected = viewMode === item.id;

          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              style={[styles.viewTab, selected && styles.viewTabActive]}
              onPress={() => setViewMode(item.id)}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={selected ? '#06130B' : '#A1A1AA'}
              />
              <Text style={[styles.viewTabText, selected && styles.viewTabTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {viewMode === 'cities' ? (
        <>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#71717A" />
            <TextInput
              value={citySearch}
              onChangeText={setCitySearch}
              placeholder="Procurar cidade"
              placeholderTextColor="#71717A"
              style={styles.searchInput}
            />
            {!!citySearch && (
              <TouchableOpacity onPress={() => setCitySearch('')}>
                <Ionicons name="close-circle" size={20} color="#71717A" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cidades</Text>
            <Text style={styles.sectionSubtitle}>Ordenadas por mais usuários</Text>
          </View>

          {loading ? (
            <LoadingCard />
          ) : cities.length === 0 ? (
            <EmptyCard
              icon="location-outline"
              title="Nenhuma cidade encontrada"
              text="Cadastre a cidade no perfil do usuário ou ajuste a busca."
            />
          ) : (
            cities.map((city, index) => (
              <TouchableOpacity
                key={city.id}
                activeOpacity={0.88}
                style={styles.cityCard}
                onPress={() => openCityUsers(city)}
              >
                <View style={styles.cityRankBadge}>
                  <Text style={styles.cityRankText}>{index + 1}</Text>
                </View>

                <View style={styles.cityIconBox}>
                  <Ionicons name="location-outline" size={24} color="#22C55E" />
                </View>

                <View style={styles.cityInfo}>
                  <Text style={styles.cityName}>{city.name}</Text>
                  <Text style={styles.cityUf}>{city.uf}</Text>
                </View>

                <View style={styles.cityCountBox}>
                  <Text style={styles.cityCountValue}>{city.users_count}</Text>
                  <Text style={styles.cityCountLabel}>usuários</Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#71717A" />
              </TouchableOpacity>
            ))
          )}
        </>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#71717A" />
            <TextInput
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Procurar usuário"
              placeholderTextColor="#71717A"
              style={styles.searchInput}
            />
            {!!userSearch && (
              <TouchableOpacity onPress={() => setUserSearch('')}>
                <Ionicons name="close-circle" size={20} color="#71717A" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Usuários</Text>
            <Text style={styles.sectionSubtitle}>Ordem crescente de criação</Text>
          </View>

          {loading ? (
            <LoadingCard />
          ) : users.length === 0 ? (
            <EmptyCard
              icon="person-outline"
              title="Nenhum usuário encontrado"
              text="Ajuste a busca ou o filtro selecionado."
            />
          ) : (
            users.map((item) => <UserCard key={item.id} user={item} />)
          )}
        </>
      )}
    </ScrollView>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
        <View style={[styles.summaryIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function UserCard({ user }: { user: AdminUser }) {
  const status = getUserStatusInfo(user);
  const dueDate = getUserDueDateInfo(user);
  const name = getAdminUserDisplayName(user);
  const isNew = isNewAdminUser(user);
  const city = user.municipality
    ? `${user.municipality.name} - ${user.municipality.uf}`
    : 'Cidade não informada';

  return (
    <View style={styles.userCard}>
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={styles.userAvatar} />
      ) : (
        <View style={styles.userAvatarFallback}>
          <Ionicons name="person" size={22} color="#FFFFFF" />
        </View>
      )}

      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName} numberOfLines={1}>{name}</Text>

          {isNew ? (
            <View style={styles.newUserMiniBadge}>
              <Text style={styles.newUserMiniBadgeText}>Novo</Text>
            </View>
          ) : null}

          {user.is_admin ? (
            <View style={styles.adminMiniBadge}>
              <Ionicons name="shield-checkmark-outline" size={12} color="#60A5FA" />
            </View>
          ) : null}
        </View>

        <Text style={styles.userMeta} numberOfLines={1}>{user.email || city}</Text>
        <Text style={styles.userMeta} numberOfLines={1}>{city}</Text>

        <View style={styles.userDatesRow}>
          <Text style={styles.userCreatedAt}>
            Criado em {formatDate(user.created_at)}
          </Text>

          <Text style={styles.userDateSeparator}>•</Text>

          <View style={styles.userDueDateRow}>
            <Ionicons name={dueDate.icon} size={12} color={dueDate.color} />
            <Text
              style={[styles.userDueDateText, { color: dueDate.color }]}
              numberOfLines={1}
            >
              {dueDate.label}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.userStatusBadge,
          {
            backgroundColor: status.backgroundColor,
            borderColor: status.borderColor,
          },
        ]}
      >
        <Text style={[styles.userStatusText, { color: status.color }]}>{status.label}</Text>
      </View>
    </View>
  );
}

function LoadingCard() {
  return (
    <View style={styles.feedbackCard}>
      <ActivityIndicator color="#22C55E" />
      <Text style={styles.feedbackText}>Carregando dados...</Text>
    </View>
  );
}

function EmptyCard({
  icon,
  title,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.feedbackCard}>
      <Ionicons name={icon} size={30} color="#71717A" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.feedbackText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  content: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 140 },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#A1A1AA', fontSize: 13, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  configButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#102A1A',
    borderWidth: 1,
    borderColor: '#14532D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerEyebrow: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  summaryCard: {
    width: '48%',
    minHeight: 46,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: { color: '#A1A1AA', fontSize: 12, fontWeight: '800' },
  summaryValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 4 },
  statusTabs: { gap: 8, paddingBottom: 12 },
  statusTab: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusTabActive: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  statusTabText: { color: '#A1A1AA', fontSize: 12, fontWeight: '900' },
  statusTabTextActive: { color: '#06130B' },
  viewTabsContainer: {
    height: 54,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 20,
    padding: 5,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  viewTab: {
    flex: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  viewTabActive: { backgroundColor: '#22C55E' },
  viewTabText: { color: '#A1A1AA', fontSize: 13, fontWeight: '900' },
  viewTabTextActive: { color: '#06130B' },
  searchBox: {
    height: 56,
    borderRadius: 19,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 16,
  },
  searchInput: { flex: 1, height: '100%', color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  sectionSubtitle: { color: '#71717A', fontSize: 12, fontWeight: '700', marginTop: 4 },
  cityCard: {
    minHeight: 82,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 11,
  },
  cityRankBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityRankText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  cityIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityInfo: { flex: 1 },
  cityName: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  cityUf: { color: '#A1A1AA', fontSize: 12, fontWeight: '800', marginTop: 3 },
  cityCountBox: { alignItems: 'flex-end' },
  cityCountValue: { color: '#22C55E', fontSize: 20, fontWeight: '900' },
  cityCountLabel: { color: '#71717A', fontSize: 10, fontWeight: '800' },
  userCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 11,
  },
  userAvatar: { width: 48, height: 48, borderRadius: 16 },
  userAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  userName: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', flex: 1 },
  adminMiniBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newUserMiniBadge: {
    minHeight: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.25)',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newUserMiniBadgeText: {
    color: '#FACC15',
    fontSize: 10,
    fontWeight: '900',
  },
  userMeta: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', marginTop: 3 },
  userDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  userCreatedAt: { color: '#71717A', fontSize: 11, fontWeight: '700' },
  userDateSeparator: { color: '#3F3F46', fontSize: 11, fontWeight: '900' },
  userDueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  userDueDateText: { fontSize: 11, fontWeight: '900' },
  userStatusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  userStatusText: { fontSize: 10, fontWeight: '900' },
  feedbackCard: {
    minHeight: 160,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  feedbackText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 18 },
});
