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
    color: '#9B969B',
    backgroundColor: 'rgba(143,138,145,0.10)',
    borderColor: 'rgba(143,138,145,0.22)',
  };
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
        Alert.alert(
          'Acesso negado',
          'Essa área é permitida somente para administradores.',
        );
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
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível carregar os usuários.',
      );
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
        <ActivityIndicator color="#D4A64A" />
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
          <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerEyebrow}>Usuários por cidade</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {cityName} {uf ? `- ${uf}` : ''}
          </Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{users.length}</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIconBox}>
          <Ionicons name="people-outline" size={25} color="#D4A64A" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Usuários encontrados</Text>
          <Text style={styles.heroText}>
            Lista filtrada pela cidade selecionada no painel administrativo.
          </Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#8F8A91" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar usuário nesta cidade"
          placeholderTextColor="#8F8A91"
          style={styles.searchInput}
        />
        {!!search && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#8F8A91" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.feedbackCard}>
          <ActivityIndicator color="#D4A64A" />
          <Text style={styles.feedbackText}>Carregando usuários...</Text>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.feedbackCard}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="people-outline" size={32} color="#8F8A91" />
          </View>
          <Text style={styles.emptyTitle}>Nenhum usuário encontrado</Text>
          <Text style={styles.feedbackText}>
            Ajuste a busca ou verifique o cadastro da cidade.
          </Text>
        </View>
      ) : (
        <View style={styles.userList}>
          {users.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </View>
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
          <Ionicons name="person" size={22} color="#D4A64A" />
        </View>
      )}

      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {name}
        </Text>

        <Text style={styles.userMeta} numberOfLines={1}>
          {user.email || 'E-mail não informado'}
        </Text>

        <View style={styles.userDatesRow}>
          <View style={styles.userDatePill}>
            <Ionicons name="calendar-outline" size={12} color="#8F8A91" />
            <Text style={styles.userCreatedAt}>
              Criado em {formatDate(user.created_at)}
            </Text>
          </View>

          <View style={styles.userDatePill}>
            <Ionicons name="time-outline" size={12} color="#D4A64A" />
            <Text style={styles.userDueAt}>
              Vence em {formatDate(user.subscription_due_at)}
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
        <Text style={[styles.userStatusText, { color: status.color }]}>
          {status.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 50,
    paddingBottom: 150,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  loadingText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -18,
    marginTop: -50,
    marginBottom: 18,
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
  },

  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerInfo: {
    flex: 1,
    minWidth: 0,
  },

  headerEyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: '#F5F0E6',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.4,
  },

  countBadge: {
    minWidth: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  countBadgeText: {
    color: '#D4A64A',
    fontSize: 16,
    fontWeight: '900',
  },

  heroCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 16,
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 8,
  },

  heroIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroTitle: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
  },

  heroText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },

  searchBox: {
    height: 56,
    borderRadius: 15,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 16,
  },

  searchInput: {
    flex: 1,
    height: '100%',
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '800',
  },

  userList: {
    gap: 11,
  },

  userCard: {
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },

  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
  },

  userAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  userInfo: {
    flex: 1,
    minWidth: 0,
  },

  userName: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  userMeta: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  userDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 7,
  },

  userDatePill: {
    minHeight: 25,
    borderRadius: 999,
    backgroundColor: 'rgba(143,138,145,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(143,138,145,0.18)',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  userCreatedAt: {
    color: '#8F8A91',
    fontSize: 10,
    fontWeight: '800',
  },

  userDueAt: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
  },

  userStatusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  userStatusText: {
    fontSize: 10,
    fontWeight: '900',
  },

  feedbackCard: {
    minHeight: 170,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },

  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 17,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },

  feedbackText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
});
