import { useEffect, useState } from 'react';
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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getCurrentUserIsAdmin } from '../../../src/features/admin/services/adminAccess';
import {
  AdminStatusFilter,
  AdminUser,
  getAdminUserDisplayName,
  getAdminUsers,
  isActiveAdminUser,
  isInactiveAdminUser,
} from '../../../src/features/admin/services/adminDashboard';

function formatDate(value?: string | null) {
  if (!value) return '--/--/----';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '--/--/----';

  return date.toLocaleDateString('pt-BR');
}

function getUserStatusInfo(user: AdminUser) {
  if (isInactiveAdminUser(user)) {
    return { label: 'Inativo', color: '#F87171', backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.24)' };
  }

  if (isActiveAdminUser(user)) {
    return { label: 'Ativo', color: '#22C55E', backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.24)' };
  }

  return { label: 'Sem status', color: '#A1A1AA', backgroundColor: 'rgba(161,161,170,0.10)', borderColor: 'rgba(161,161,170,0.20)' };
}

export default function AdminCityUsersScreen() {
  const params = useLocalSearchParams<{
    cityId?: string;
    cityName?: string;
    uf?: string;
    statusFilter?: AdminStatusFilter;
  }>();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);

  const cityId = String(params.cityId ?? '');
  const cityName = String(params.cityName ?? 'Cidade');
  const uf = String(params.uf ?? '');
  const statusFilter = (params.statusFilter ?? 'all') as AdminStatusFilter;

  async function validateAndLoad() {
    try {
      setCheckingAccess(true);

      const isAdmin = await getCurrentUserIsAdmin();

      if (!isAdmin) {
        Alert.alert('Acesso negado', 'Essa área é permitida somente para administradores.');
        router.replace('/(private)/(tabs)/dashboard' as never);
        return;
      }

      await loadUsers();
    } catch (error) {
      console.log('Erro ao validar admin:', error);
      router.replace('/(private)/(tabs)/dashboard' as never);
    } finally {
      setCheckingAccess(false);
    }
  }

  async function loadUsers() {
    try {
      setLoading(true);

      const response = await getAdminUsers({
        cityId,
        statusFilter,
        search,
      });

      setUsers(response);
    } catch (error: any) {
      console.log('Erro ao carregar usuários da cidade:', error);
      Alert.alert('Erro', error?.message ?? 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    validateAndLoad();
  }, [cityId, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!checkingAccess && cityId) {
        loadUsers();
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [search]);

  if (checkingAccess) {
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
          <Text style={styles.headerEyebrow}>Usuários por cidade</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{cityName} {uf ? `- ${uf}` : ''}</Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{users.length}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#71717A" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar usuário nesta cidade"
          placeholderTextColor="#71717A"
          style={styles.searchInput}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#71717A" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.feedbackCard}>
          <ActivityIndicator color="#22C55E" />
          <Text style={styles.feedbackText}>Carregando usuários...</Text>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.feedbackCard}>
          <Ionicons name="people-outline" size={30} color="#71717A" />
          <Text style={styles.emptyTitle}>Nenhum usuário encontrado</Text>
          <Text style={styles.feedbackText}>Ajuste a busca ou verifique o cadastro da cidade.</Text>
        </View>
      ) : (
        users.map((user) => <UserCard key={user.id} user={user} />)
      )}
    </ScrollView>
  );
}

function UserCard({ user }: { user: AdminUser }) {
  const status = getUserStatusInfo(user);
  const name = getAdminUserDisplayName(user);

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
        <Text style={styles.userName} numberOfLines={1}>{name}</Text>
        <Text style={styles.userMeta} numberOfLines={1}>{user.email || 'E-mail não informado'}</Text>
        <Text style={styles.userCreatedAt}>Criado em {formatDate(user.created_at)}</Text>
        <Text style={styles.userDueAt}>Vence em {formatDate(user.subscription_due_at)}</Text>
      </View>

      <View style={[styles.userStatusBadge, { backgroundColor: status.backgroundColor, borderColor: status.borderColor }]}> 
        <Text style={[styles.userStatusText, { color: status.color }]}>{status.label}</Text>
      </View>
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
  headerInfo: { flex: 1 },
  headerEyebrow: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 2 },
  countBadge: {
    minWidth: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#102A1A',
    borderWidth: 1,
    borderColor: '#14532D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  countBadgeText: { color: '#22C55E', fontSize: 16, fontWeight: '900' },
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
  userName: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  userMeta: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', marginTop: 3 },
  userCreatedAt: { color: '#71717A', fontSize: 11, fontWeight: '700', marginTop: 3 },
  userDueAt: { color: '#A1A1AA', fontSize: 11, fontWeight: '800', marginTop: 3 },
  userStatusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
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
