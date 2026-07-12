import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '../../../src/database/supabase';

import { getCurrentUserIsAdmin } from '../../../src/features/admin/services/adminAccess';
import {
  applyUserDiscountRule,
  removeUserDiscountRule,
  setUserAdminStatus,
  setUserFreePlan,
  updateUserSubscriptionDueDate,
} from '../../../src/features/admin/services/adminUserActions';
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

type IconName = keyof typeof Ionicons.glyphMap;
type AdminBottomTab = 'users' | 'cities' | 'admins' | 'rules';
type RuleFilter = 'all' | 'free' | 'discount' | 'custom';
type DiscountType = 'amount' | 'percentage';
type UserRuleType = 'free' | 'discount' | 'custom';

type UserRuleInfo = {
  type: UserRuleType;
  title: string;
  description: string;
  color: string;
  backgroundColor: string;
  icon: IconName;
  endsAt?: string | null;
  discountType?: DiscountType;
  discountValue?: number | null;
};

const bottomTabs: { id: AdminBottomTab; label: string; icon: IconName }[] = [
  { id: 'cities', label: 'Cidade', icon: 'location-outline' },
  { id: 'users', label: 'Usuários', icon: 'people-outline' },
  { id: 'admins', label: 'Admin', icon: 'shield-checkmark-outline' },
  { id: 'rules', label: 'Regras', icon: 'options-outline' },
];

const statusTabs: { id: AdminStatusFilter; label: string; icon: IconName }[] = [
  { id: 'all', label: 'Todos', icon: 'people-outline' },
  { id: 'new', label: 'Novos', icon: 'sparkles-outline' },
  { id: 'active', label: 'Ativos', icon: 'checkmark-circle-outline' },
  { id: 'inactive', label: 'Inativos', icon: 'close-circle-outline' },
];

const ruleTabs: { id: RuleFilter; label: string; icon: IconName }[] = [
  { id: 'all', label: 'Todas', icon: 'list-outline' },
  { id: 'free', label: 'Gratuito', icon: 'gift-outline' },
  { id: 'discount', label: 'Desconto', icon: 'pricetag-outline' },
  { id: 'custom', label: 'Outras', icon: 'settings-outline' },
];

function normalize(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function onlyNumbers(value: string) {
  return String(value ?? '').replace(/\D/g, '');
}

function maskDateInput(value: string) {
  const numbers = onlyNumbers(value).slice(0, 8);

  return numbers
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
}

function parseDateWithoutTimezone(value?: string | null) {
  if (!value) return null;

  const raw = String(value);
  const dateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  const fallback = new Date(raw);

  if (Number.isNaN(fallback.getTime())) return null;

  return fallback;
}

function formatDate(value?: string | null) {
  const date = parseDateWithoutTimezone(value);

  if (!date) return '--/--/----';

  return date.toLocaleDateString('pt-BR');
}

function dateToInput(value?: string | null) {
  const date = parseDateWithoutTimezone(value);

  if (!date) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());

  return `${day}/${month}/${year}`;
}

function formatDiscountValue(value?: number | null) {
  if (!value) return '';

  return String(value).replace('.', ',');
}

function parseNumeric(value: unknown) {
  const normalized = String(value ?? '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const number = Number(normalized);

  return Number.isFinite(number) ? number : 0;
}

function getUserCityLabel(user?: AdminUser | null) {
  if (!user?.municipality) return 'Cidade não informada';

  return `${user.municipality.name} - ${user.municipality.uf}`;
}

function getRuleRaw(user: AdminUser) {
  const anyUser = user as any;

  return (
    anyUser.subscription_rule ||
    anyUser.user_subscription_rule ||
    anyUser.rule ||
    null
  );
}


function getUserHasDiscountRule(user: AdminUser) {
  return Boolean(getUserDiscountRuleInfo(user));
}

function getUserHasFreePlanRule(user: AdminUser) {
  return getUserIsFreePlan(user);
}

function getUserHasAdminRule(user: AdminUser) {
  return Boolean(user.is_admin);
}

function getUserBlockingRule(user: AdminUser) {
  if (getUserHasAdminRule(user)) {
    return {
      type: 'admin' as const,
      title: 'Usuário definido como admin',
      message:
        'Enquanto este usuário estiver definido como admin, desconto, plano gratuito e alteração manual de vencimento ficam bloqueados.',
    };
  }

  if (getUserHasFreePlanRule(user)) {
    return {
      type: 'free' as const,
      title: 'Plano gratuito ativo',
      message:
        'Enquanto este usuário estiver com plano gratuito, desconto, admin e alteração manual de vencimento ficam bloqueados.',
    };
  }

  if (getUserHasDiscountRule(user)) {
    return {
      type: 'discount' as const,
      title: 'Desconto ativo',
      message:
        'Enquanto este usuário estiver com desconto, plano gratuito, admin e alteração manual de vencimento ficam bloqueados.',
    };
  }

  return null;
}

function showBlockedAdminActionAlert(user: AdminUser, message?: string) {
  Alert.alert(
    'Ação bloqueada',
    message || getUserBlockingRule(user)?.message || 'Esta ação está bloqueada para este usuário.',
  );
}

type AdminNotificationPayload = {
  userId: string;
  title: string;
  message: string;
  type: string;
  referenceId?: string | null;
};

/*
  Gera uma notificação administrativa para o usuário afetado.

  A notificação é criada na tabela notifications como não lida.
  A coluna read fica false dentro da RPC admin_create_user_notification.

  Quando o usuário clicar na notificação, a tela app/(private)/notifications
  já chama markNotificationAsRead(notification.id), então ela passa para lida.
*/
async function createAdminUserNotification({
  userId,
  title,
  message,
  type,
  referenceId,
}: AdminNotificationPayload) {
  const { error } = await (supabase as any).rpc(
    'admin_create_user_notification',
    {
      p_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: type,
      p_reference_id: referenceId ?? userId,
    },
  );

  if (error) {
    throw error;
  }
}

function buildDiscountDescription(
  discountType: DiscountType,
  discountValue: string,
) {
  const value = parseNumeric(discountValue);

  if (discountType === 'amount') {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }

  return `${value}%`;
}

function getUserRuleInfo(user: AdminUser): UserRuleInfo | null {
  const anyUser = user as any;
  const rule = getRuleRaw(user) as any;

  const rawType = normalize(
    rule?.rule_type ||
      rule?.type ||
      anyUser.rule_type ||
      anyUser.subscription_rule_type ||
      anyUser.plan_rule_type ||
      anyUser.plan_type,
  );

  const discountTypeRaw = normalize(
    rule?.discount_type ||
      anyUser.discount_type ||
      anyUser.subscription_discount_type,
  );

  const discountValue = parseNumeric(
    rule?.discount_value ??
      rule?.discount_percent ??
      rule?.discount_percentage ??
      anyUser.discount_value ??
      anyUser.discount_percent ??
      anyUser.discount_percentage,
  );

  const hasFreePlan =
    Boolean(user.is_admin) ||
    Boolean(rule?.is_free_plan) ||
    Boolean(anyUser.is_free_plan) ||
    Boolean(anyUser.has_free_plan) ||
    rawType.includes('admin_free') ||
    rawType.includes('free') ||
    rawType.includes('gratis') ||
    rawType.includes('gratuito');

  if (hasFreePlan) {
    return {
      type: 'free',
      title: user.is_admin ? 'Administrador' : 'Plano gratuito',
      description:
        rule?.description ||
        rule?.label ||
        (user.is_admin
          ? 'Administradores possuem plano gratuito por padrão.'
          : 'Usuário com plano gratuito aplicado.'),
      color: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.12)',
      icon: user.is_admin ? 'shield-checkmark-outline' : 'gift-outline',
      endsAt: rule?.ends_at || anyUser.free_plan_until || null,
    };
  }

  const hasDiscount =
    discountValue > 0 ||
    Boolean(rule?.has_discount) ||
    Boolean(anyUser.has_discount) ||
    rawType.includes('discount') ||
    rawType.includes('desconto');

  if (hasDiscount) {
    const discountType: DiscountType =
      discountTypeRaw === 'amount' ? 'amount' : 'percentage';

    return {
      type: 'discount',
      title:
        discountValue > 0
          ? discountType === 'amount'
            ? `Desconto de R$ ${discountValue.toFixed(2).replace('.', ',')}`
            : `Desconto de ${discountValue}%`
          : 'Plano com desconto',
      description:
        rule?.description ||
        rule?.label ||
        'Usuário com desconto aplicado na assinatura.',
      color: '#FACC15',
      backgroundColor: 'rgba(250,204,21,0.12)',
      icon: 'pricetag-outline',
      endsAt: rule?.ends_at || anyUser.discount_until || null,
      discountType,
      discountValue,
    };
  }

  if (rule || rawType) {
    return {
      type: 'custom',
      title: rule?.label || anyUser.rule_label || 'Regra personalizada',
      description:
        rule?.description ||
        'Usuário possui uma regra personalizada aplicada.',
      color: '#C084FC',
      backgroundColor: 'rgba(192,132,252,0.12)',
      icon: 'options-outline',
      endsAt: rule?.ends_at || null,
    };
  }

  return null;
}

function getUserDiscountRuleInfo(user?: AdminUser | null) {
  if (!user) return null;

  const rule = getUserRuleInfo(user);

  return rule?.type === 'discount' ? rule : null;
}

function getUserIsFreePlan(user?: AdminUser | null) {
  if (!user) return false;

  return Boolean(user.is_admin) || getUserRuleInfo(user)?.type === 'free';
}

function getUserStatusInfo(user: AdminUser) {
  if (isNewAdminUser(user)) {
    return {
      label: 'Novo',
      color: '#FACC15',
      backgroundColor: 'rgba(250,204,21,0.12)',
      borderColor: 'rgba(250,204,21,0.24)',
      icon: 'sparkles-outline' as IconName,
    };
  }

  if (isInactiveAdminUser(user)) {
    return {
      label: 'Inativo',
      color: '#F87171',
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderColor: 'rgba(239,68,68,0.24)',
      icon: 'close-circle-outline' as IconName,
    };
  }

  if (isActiveAdminUser(user)) {
    return {
      label: 'Ativo',
      color: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.24)',
      icon: 'checkmark-circle-outline' as IconName,
    };
  }

  return {
    label: 'Sem status',
    color: '#9B969B',
    backgroundColor: 'rgba(161,161,170,0.10)',
    borderColor: 'rgba(161,161,170,0.20)',
    icon: 'help-circle-outline' as IconName,
  };
}

function getUserDueDateInfo(user: AdminUser) {
  if (getUserIsFreePlan(user)) {
    return {
      label: 'Não se aplica',
      color: '#22C55E',
      icon: 'gift-outline' as IconName,
    };
  }

  const value = user.subscription_due_at;

  if (!value) {
    return {
      label: 'Sem vencimento',
      color: '#9B969B',
      icon: 'calendar-outline' as IconName,
    };
  }

  const dueDate = parseDateWithoutTimezone(value);

  if (!dueDate) {
    return {
      label: 'Vencimento inválido',
      color: '#9B969B',
      icon: 'calendar-outline' as IconName,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedDueDate = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );

  const diffDays = Math.round(
    (normalizedDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) {
    return {
      label: `Venceu em ${formatDate(value)}`,
      color: '#F87171',
      icon: 'alert-circle-outline' as IconName,
    };
  }

  if (diffDays === 0) {
    return {
      label: `Vence hoje (${formatDate(value)})`,
      color: '#FACC15',
      icon: 'time-outline' as IconName,
    };
  }

  if (diffDays === 1) {
    return {
      label: `Vence amanhã (${formatDate(value)})`,
      color: '#FACC15',
      icon: 'time-outline' as IconName,
    };
  }

  return {
    label: `${formatDate(value)} · vence em ${diffDays} dias`,
    color: '#22C55E',
    icon: 'calendar-outline' as IconName,
  };
}

function matchesUserSearch(user: AdminUser, search: string) {
  const term = normalize(search);

  if (!term) return true;

  const city = getUserCityLabel(user);

  return [
    user.full_name,
    user.name,
    user.username,
    user.email,
    user.subscription_status,
    city,
  ].some((item) => normalize(item).includes(term));
}

function matchesStatus(user: AdminUser, status: AdminStatusFilter) {
  if (status === 'new') {
    return isNewAdminUser(user);
  }

  if (status === 'active') {
    return isActiveAdminUser(user);
  }

  if (status === 'inactive') {
    return isInactiveAdminUser(user);
  }

  return true;
}

function matchesRuleFilter(user: AdminUser, filter: RuleFilter) {
  const rule = getUserRuleInfo(user);

  if (!rule) return false;
  if (filter === 'all') return true;

  return rule.type === filter;
}

export default function AdminHomeScreen() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeMenu, setActiveMenu] = useState<AdminBottomTab>('users');
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>('all');
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('all');

  const [userSearch, setUserSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [cityUserSearch, setCityUserSearch] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [rulesSearch, setRulesSearch] = useState('');

  const [selectedCity, setSelectedCity] = useState<AdminCity | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);

  const [dueDateModalVisible, setDueDateModalVisible] = useState(false);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);

  const [dueDateInput, setDueDateInput] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [cities, setCities] = useState<AdminCity[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  async function validateAdminAccess() {
    try {
      setCheckingAccess(true);

      const response = await getCurrentUserIsAdmin();

      setIsAdmin(response);

      if (!response) {
        Alert.alert(
          'Acesso negado',
          'Essa área é permitida somente para administradores.',
        );
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
        getAdminCities({ statusFilter: 'all' }),
        getAdminUsers({ statusFilter: 'all' }),
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
    }, [isAdmin]),
  );

  async function reloadAfterAction() {
    await loadAdminData(true);
  }

  function closeUserModal() {
    setSelectedUser(null);
  }

  function openDueDateAction(user: AdminUser) {
    setActionUser(user);
    setDueDateInput(dateToInput(user.subscription_due_at));
    setDueDateModalVisible(true);
  }

  function openDiscountAction(user: AdminUser) {
    const discountRule = getUserDiscountRuleInfo(user);

    setActionUser(user);
    setDiscountType(discountRule?.discountType === 'amount' ? 'amount' : 'percentage');
    setDiscountValue(formatDiscountValue(discountRule?.discountValue ?? null));
    setDiscountModalVisible(true);
  }

  async function handleUpdateDueDate() {
    if (!actionUser) return;

    try {
      setActionLoading(true);

      await updateUserSubscriptionDueDate({
        userId: actionUser.id,
        dueDate: dueDateInput,
      });

      await createAdminUserNotification({
        userId: actionUser.id,
        title: 'Vencimento alterado',
        message: `O vencimento da sua assinatura foi alterado para ${dueDateInput}. Essa alteração foi feita pela administração do sistema.`,
        type: 'admin_due_date_updated',
        referenceId: actionUser.id,
      });

      setDueDateModalVisible(false);
      setActionUser(null);
      closeUserModal();

      await reloadAfterAction();

      Alert.alert('Vencimento alterado', 'O vencimento do usuário foi atualizado.');
    } catch (error: any) {
      console.log('Erro ao alterar vencimento:', error);
      Alert.alert(
        'Não foi possível alterar',
        error?.message ?? 'Verifique a data informada e tente novamente.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApplyDiscount() {
    if (!actionUser) return;

    try {
      setActionLoading(true);

      await applyUserDiscountRule({
        userId: actionUser.id,
        discountType,
        discountValue,
      });

      await createAdminUserNotification({
        userId: actionUser.id,
        title: 'Desconto aplicado',
        message: `Foi aplicado um desconto de ${buildDiscountDescription(
          discountType,
          discountValue,
        )} na sua assinatura. Essa alteração foi feita pela administração do sistema.`,
        type: 'admin_discount_applied',
        referenceId: actionUser.id,
      });

      setDiscountModalVisible(false);
      setActionUser(null);
      closeUserModal();

      await reloadAfterAction();

      Alert.alert('Desconto salvo', 'O desconto do usuário foi atualizado.');
    } catch (error: any) {
      console.log('Erro ao aplicar desconto:', error);
      Alert.alert(
        'Não foi possível salvar',
        error?.message ?? 'Verifique o desconto informado e tente novamente.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  function confirmRemoveDiscount(user: AdminUser) {
    if (!getUserDiscountRuleInfo(user)) {
      Alert.alert(
        'Sem desconto aplicado',
        'Esse usuário não possui desconto ativo para remover.',
      );
      return;
    }

    Alert.alert(
      'Remover desconto',
      'O desconto aplicado será removido e o usuário voltará ao valor normal da mensalidade.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => handleRemoveDiscount(user),
        },
      ],
    );
  }

  async function handleRemoveDiscount(user: AdminUser) {
    try {
      setActionLoading(true);

      await removeUserDiscountRule({ userId: user.id });

      await createAdminUserNotification({
        userId: user.id,
        title: 'Desconto removido',
        message:
          'O desconto da sua assinatura foi removido. A partir de agora, sua conta seguirá o valor normal da mensalidade.',
        type: 'admin_discount_removed',
        referenceId: user.id,
      });

      closeUserModal();

      await reloadAfterAction();

      Alert.alert(
        'Desconto removido',
        'O usuário voltou ao valor normal da mensalidade.',
      );
    } catch (error: any) {
      console.log('Erro ao remover desconto:', error);
      Alert.alert(
        'Não foi possível remover',
        error?.message ?? 'Tente novamente.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  function confirmToggleAdmin(user: AdminUser) {
    const nextValue = !user.is_admin;

    Alert.alert(
      nextValue ? 'Definir como admin' : 'Remover admin',
      nextValue
        ? 'Esse usuário será administrador e terá plano gratuito por padrão.'
        : 'Esse usuário deixará de ser administrador e o vencimento será definido para 10 dias após o dia atual.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: nextValue ? 'Definir' : 'Remover',
          style: nextValue ? 'default' : 'destructive',
          onPress: () => handleToggleAdmin(user, nextValue),
        },
      ],
    );
  }

  async function handleToggleAdmin(user: AdminUser, nextValue: boolean) {
    try {
      setActionLoading(true);

      await setUserAdminStatus({
        userId: user.id,
        isAdmin: nextValue,
      });

      await createAdminUserNotification({
        userId: user.id,
        title: nextValue ? 'Usuário definido como admin' : 'Admin removido',
        message: nextValue
          ? 'Sua conta foi definida como administradora. Você recebeu acesso às permissões administrativas do sistema e terá plano gratuito por padrão enquanto for admin.'
          : 'Sua conta deixou de ser administradora. O vencimento da sua assinatura foi definido para 10 dias após hoje.',
        type: nextValue ? 'admin_role_enabled' : 'admin_role_disabled',
        referenceId: user.id,
      });

      closeUserModal();

      await reloadAfterAction();

      Alert.alert(
        nextValue ? 'Admin definido' : 'Admin removido',
        nextValue
          ? 'O usuário agora é admin e possui plano gratuito por padrão.'
          : 'O usuário deixou de ser admin e o vencimento foi definido para 10 dias após hoje.',
      );
    } catch (error: any) {
      console.log('Erro ao alterar admin:', error);
      Alert.alert('Não foi possível alterar', error?.message ?? 'Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  }

  function confirmToggleFreePlan(user: AdminUser) {
    if (user.is_admin) {
      Alert.alert(
        'Plano gratuito por padrão',
        'Administradores já possuem plano gratuito por padrão. Para remover esse benefício, primeiro remova o usuário como administrador.',
      );
      return;
    }

    const nextValue = !getUserIsFreePlan(user);

    Alert.alert(
      nextValue ? 'Ativar plano gratuito' : 'Remover plano gratuito',
      nextValue
        ? 'Esse usuário não pagará mensalidade enquanto o plano gratuito estiver ativo.'
        : 'Esse usuário voltará a seguir as regras normais de cobrança e o vencimento será definido para 10 dias após o dia atual.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: nextValue ? 'Ativar' : 'Remover',
          style: nextValue ? 'default' : 'destructive',
          onPress: () => handleToggleFreePlan(user, nextValue),
        },
      ],
    );
  }

  async function handleToggleFreePlan(user: AdminUser, nextValue: boolean) {
    try {
      setActionLoading(true);

      await setUserFreePlan({
        userId: user.id,
        isFree: nextValue,
      });

      await createAdminUserNotification({
        userId: user.id,
        title: nextValue ? 'Plano gratuito ativado' : 'Plano gratuito removido',
        message: nextValue
          ? 'Sua conta foi definida com plano gratuito. Enquanto essa regra estiver ativa, você não pagará mensalidade.'
          : 'O plano gratuito da sua conta foi removido. O vencimento da sua assinatura foi definido para 10 dias após hoje.',
        type: nextValue ? 'admin_free_plan_enabled' : 'admin_free_plan_disabled',
        referenceId: user.id,
      });

      closeUserModal();

      await reloadAfterAction();

      Alert.alert(
        nextValue ? 'Plano gratuito ativado' : 'Plano gratuito removido',
        nextValue
          ? 'O usuário não pagará mensalidade enquanto estiver com plano gratuito.'
          : 'O usuário voltou às regras normais de cobrança e o vencimento foi definido para 10 dias após hoje.',
      );
    } catch (error: any) {
      console.log('Erro ao alterar plano gratuito:', error);
      Alert.alert('Não foi possível alterar', error?.message ?? 'Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  }

  const summary = useMemo(() => {
    return {
      total: users.length,
      newest: users.filter(isNewAdminUser).length,
      active: users.filter(isActiveAdminUser).length,
      inactive: users.filter(isInactiveAdminUser).length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(
      (user) => matchesStatus(user, statusFilter) && matchesUserSearch(user, userSearch),
    );
  }, [users, statusFilter, userSearch]);

  const filteredCities = useMemo(() => {
    const term = normalize(citySearch);

    return cities.filter((city) => {
      if (!term) return true;

      return normalize(`${city.name} ${city.uf}`).includes(term);
    });
  }, [cities, citySearch]);

  const selectedCityUsers = useMemo(() => {
    if (!selectedCity) return [];

    return users.filter(
      (user) =>
        user.municipality?.id === selectedCity.id &&
        matchesStatus(user, statusFilter) &&
        matchesUserSearch(user, cityUserSearch),
    );
  }, [users, selectedCity, statusFilter, cityUserSearch]);

  const adminUsers = useMemo(() => {
    return users.filter(
      (user) => Boolean(user.is_admin) && matchesUserSearch(user, adminSearch),
    );
  }, [users, adminSearch]);

  const rulesUsers = useMemo(() => {
    return users.filter(
      (user) =>
        matchesRuleFilter(user, ruleFilter) &&
        matchesUserSearch(user, rulesSearch),
    );
  }, [users, ruleFilter, rulesSearch]);

  const rulesTotal = useMemo(() => {
    return users.filter((user) => Boolean(getUserRuleInfo(user))).length;
  }, [users]);

  function changeMenu(tab: AdminBottomTab) {
    setActiveMenu(tab);

    if (tab !== 'cities') {
      setSelectedCity(null);
      setCityUserSearch('');
    }
  }

  if (checkingAccess || !isAdmin) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#D4A64A" />
        <Text style={styles.loadingText}>Verificando acesso...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header activeMenu={activeMenu} selectedCity={selectedCity} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor="#D4A64A"
            refreshing={refreshing}
            onRefresh={() => loadAdminData(true)}
          />
        }
      >

        {activeMenu === 'users' ? (
          <UsersSection
            loading={loading}
            summary={summary}
            users={filteredUsers}
            search={userSearch}
            statusFilter={statusFilter}
            onChangeSearch={setUserSearch}
            onChangeStatus={setStatusFilter}
            onOpenUser={setSelectedUser}
          />
        ) : null}

        {activeMenu === 'cities' ? (
          <CitiesSection
            loading={loading}
            cities={filteredCities}
            totalCities={cities.length}
            selectedCity={selectedCity}
            selectedCityUsers={selectedCityUsers}
            statusFilter={statusFilter}
            citySearch={citySearch}
            cityUserSearch={cityUserSearch}
            onChangeCitySearch={setCitySearch}
            onChangeCityUserSearch={setCityUserSearch}
            onChangeStatus={setStatusFilter}
            onSelectCity={setSelectedCity}
            onBackCity={() => {
              setSelectedCity(null);
              setCityUserSearch('');
            }}
            onOpenUser={setSelectedUser}
          />
        ) : null}

        {activeMenu === 'admins' ? (
          <AdminsSection
            loading={loading}
            totalAdmins={users.filter((user) => Boolean(user.is_admin)).length}
            admins={adminUsers}
            search={adminSearch}
            onChangeSearch={setAdminSearch}
            onOpenUser={setSelectedUser}
          />
        ) : null}

        {activeMenu === 'rules' ? (
          <RulesSection
            loading={loading}
            totalRules={rulesTotal}
            users={rulesUsers}
            search={rulesSearch}
            ruleFilter={ruleFilter}
            onChangeSearch={setRulesSearch}
            onChangeRuleFilter={setRuleFilter}
            onOpenUser={setSelectedUser}
          />
        ) : null}
      </ScrollView>

      <View style={styles.bottomMenuWrapper}>
        <View style={styles.bottomMenu}>
          {bottomTabs.map((tab) => {
            const selected = activeMenu === tab.id;

            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.86}
                style={[styles.bottomMenuItem, selected && styles.bottomMenuItemActive]}
                onPress={() => changeMenu(tab.id)}
              >
                <Ionicons
                  name={tab.icon}
                  size={20}
                  color={selected ? '#080808' : '#9B969B'}
                />
                <Text
                  style={[
                    styles.bottomMenuText,
                    selected && styles.bottomMenuTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <UserDetailsModal
        user={selectedUser}
        visible={Boolean(selectedUser)}
        actionLoading={actionLoading}
        onClose={closeUserModal}
        onAlterDueDate={openDueDateAction}
        onApplyDiscount={openDiscountAction}
        onRemoveDiscount={confirmRemoveDiscount}
        onToggleAdmin={confirmToggleAdmin}
        onToggleFreePlan={confirmToggleFreePlan}
      />

      <DueDateActionModal
        visible={dueDateModalVisible}
        value={dueDateInput}
        loading={actionLoading}
        user={actionUser}
        onChangeText={(value) => setDueDateInput(maskDateInput(value))}
        onClose={() => {
          if (actionLoading) return;
          setDueDateModalVisible(false);
          setActionUser(null);
        }}
        onConfirm={handleUpdateDueDate}
      />

      <DiscountActionModal
        visible={discountModalVisible}
        discountType={discountType}
        discountValue={discountValue}
        loading={actionLoading}
        user={actionUser}
        onChangeDiscountType={setDiscountType}
        onChangeDiscountValue={setDiscountValue}
        onClose={() => {
          if (actionLoading) return;
          setDiscountModalVisible(false);
          setActionUser(null);
        }}
        onConfirm={handleApplyDiscount}
      />
    </View>
  );
}

function Header({
  activeMenu,
  selectedCity,
}: {
  activeMenu: AdminBottomTab;
  selectedCity: AdminCity | null;
}) {
  const title =
    activeMenu === 'users'
      ? 'Usuários'
      : activeMenu === 'cities'
        ? selectedCity?.name ?? 'Cidades'
        : activeMenu === 'admins'
          ? 'Administradores'
          : 'Regras';

  return (
    <View style={styles.header}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.headerIconButton}
        onPress={() => router.replace('/(private)/(tabs)/dashboard' as never)}
      >
        <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
      </TouchableOpacity>

      <View style={styles.headerInfo}>
        <Text style={styles.headerEyebrow}>Painel do sistema</Text>
        <Text style={styles.headerTitle}>Administração</Text>
        <Text style={styles.headerSubtitle}>{title}</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.configButton}
        onPress={() => router.push('/(private)/admin/configuracoes' as never)}
      >
        <Ionicons name="settings-outline" size={22} color="#D4A64A" />
      </TouchableOpacity>
    </View>
  );
}

function UsersSection({
  loading,
  summary,
  users,
  search,
  statusFilter,
  onChangeSearch,
  onChangeStatus,
  onOpenUser,
}: {
  loading: boolean;
  summary: { total: number; newest: number; active: number; inactive: number };
  users: AdminUser[];
  search: string;
  statusFilter: AdminStatusFilter;
  onChangeSearch: (value: string) => void;
  onChangeStatus: (value: AdminStatusFilter) => void;
  onOpenUser: (user: AdminUser) => void;
}) {
  return (
    <>
      <View style={styles.summaryGrid}>
        <SummaryCard label="Total" value={summary.total} icon="people-outline" color="#60A5FA" />
        <SummaryCard label="Novos" value={summary.newest} icon="sparkles-outline" color="#FACC15" />
        <SummaryCard label="Ativos" value={summary.active} icon="checkmark-circle-outline" color="#22C55E" />
        <SummaryCard label="Inativos" value={summary.inactive} icon="close-circle-outline" color="#F87171" />
      </View>

      <StatusTabs value={statusFilter} onChange={onChangeStatus} />

      <SearchBox
        value={search}
        onChangeText={onChangeSearch}
        placeholder="Buscar por nome, e-mail ou username"
      />

      <SectionTitle title="Usuários" subtitle={`${users.length} usuário(s) encontrado(s)`} />

      {loading ? (
        <LoadingCard />
      ) : users.length === 0 ? (
        <EmptyCard
          icon="person-outline"
          title="Nenhum usuário encontrado"
          text="Ajuste a busca ou o filtro selecionado."
        />
      ) : (
        users.map((user) => (
          <UserCard key={user.id} user={user} onPress={() => onOpenUser(user)} />
        ))
      )}
    </>
  );
}

function CitiesSection({
  loading,
  cities,
  totalCities,
  selectedCity,
  selectedCityUsers,
  statusFilter,
  citySearch,
  cityUserSearch,
  onChangeCitySearch,
  onChangeCityUserSearch,
  onChangeStatus,
  onSelectCity,
  onBackCity,
  onOpenUser,
}: {
  loading: boolean;
  cities: AdminCity[];
  totalCities: number;
  selectedCity: AdminCity | null;
  selectedCityUsers: AdminUser[];
  statusFilter: AdminStatusFilter;
  citySearch: string;
  cityUserSearch: string;
  onChangeCitySearch: (value: string) => void;
  onChangeCityUserSearch: (value: string) => void;
  onChangeStatus: (value: AdminStatusFilter) => void;
  onSelectCity: (city: AdminCity) => void;
  onBackCity: () => void;
  onOpenUser: (user: AdminUser) => void;
}) {
  if (selectedCity) {
    return (
      <>
        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.backToCitiesButton}
          onPress={onBackCity}
        >
          <Ionicons name="chevron-back" size={18} color="#D4A64A" />
          <Text style={styles.backToCitiesButtonText}>Voltar para cidades</Text>
        </TouchableOpacity>

        <View style={styles.singleSummaryCard}>
          <View style={styles.singleSummaryIcon}>
            <Ionicons name="location-outline" size={24} color="#D4A64A" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.singleSummaryLabel}>
              {selectedCity.name} - {selectedCity.uf}
            </Text>
            <Text style={styles.singleSummaryValue}>{selectedCity.users_count}</Text>
            <Text style={styles.singleSummaryHint}>usuário(s) nessa cidade</Text>
          </View>
        </View>

        <StatusTabs value={statusFilter} onChange={onChangeStatus} />

        <SearchBox
          value={cityUserSearch}
          onChangeText={onChangeCityUserSearch}
          placeholder="Buscar usuários dessa cidade"
        />

        <SectionTitle
          title="Usuários da cidade"
          subtitle={`${selectedCityUsers.length} encontrado(s)`}
        />

        {loading ? (
          <LoadingCard />
        ) : selectedCityUsers.length === 0 ? (
          <EmptyCard
            icon="person-outline"
            title="Nenhum usuário encontrado"
            text="Ajuste a busca ou o filtro."
          />
        ) : (
          selectedCityUsers.map((user) => (
            <UserCard key={user.id} user={user} onPress={() => onOpenUser(user)} />
          ))
        )}
      </>
    );
  }

  return (
    <>
      <View style={styles.singleSummaryCard}>
        <View style={styles.singleSummaryIcon}>
          <Ionicons name="location-outline" size={24} color="#D4A64A" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.singleSummaryLabel}>Total de cidades</Text>
          <Text style={styles.singleSummaryValue}>{totalCities}</Text>
        </View>
      </View>

      <SearchBox
        value={citySearch}
        onChangeText={onChangeCitySearch}
        placeholder="Buscar cidades"
      />

      <SectionTitle
        title="Cidades"
        subtitle="Ordenadas pelas cidades com mais usuários"
      />

      {loading ? (
        <LoadingCard />
      ) : cities.length === 0 ? (
        <EmptyCard
          icon="location-outline"
          title="Nenhuma cidade encontrada"
          text="Ajuste a busca ou confira o cadastro dos usuários."
        />
      ) : (
        cities.map((city, index) => (
          <TouchableOpacity
            key={city.id}
            activeOpacity={0.88}
            style={styles.cityCard}
            onPress={() => onSelectCity(city)}
          >
            <View style={styles.cityRankBadge}>
              <Text style={styles.cityRankText}>{index + 1}</Text>
            </View>

            <View style={styles.cityIconBox}>
              <Ionicons name="location-outline" size={23} color="#D4A64A" />
            </View>

            <View style={styles.cityInfo}>
              <Text style={styles.cityName}>{city.name}</Text>
              <Text style={styles.cityUf}>{city.uf}</Text>
            </View>

            <View style={styles.cityCountBox}>
              <Text style={styles.cityCountValue}>{city.users_count}</Text>
              <Text style={styles.cityCountLabel}>usuários</Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#8F8A91" />
          </TouchableOpacity>
        ))
      )}
    </>
  );
}

function AdminsSection({
  loading,
  totalAdmins,
  admins,
  search,
  onChangeSearch,
  onOpenUser,
}: {
  loading: boolean;
  totalAdmins: number;
  admins: AdminUser[];
  search: string;
  onChangeSearch: (value: string) => void;
  onOpenUser: (user: AdminUser) => void;
}) {
  return (
    <>
      <View style={styles.singleSummaryCard}>
        <View
          style={[
            styles.singleSummaryIcon,
            { backgroundColor: 'rgba(96,165,250,0.12)' },
          ]}
        >
          <Ionicons name="shield-checkmark-outline" size={24} color="#60A5FA" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.singleSummaryLabel}>Total de administradores</Text>
          <Text style={styles.singleSummaryValue}>{totalAdmins}</Text>
        </View>
      </View>

      <SearchBox
        value={search}
        onChangeText={onChangeSearch}
        placeholder="Buscar admin por nome, e-mail ou username"
      />

      <SectionTitle
        title="Lista de admin"
        subtitle={`${admins.length} admin(s) encontrado(s)`}
      />

      {loading ? (
        <LoadingCard />
      ) : admins.length === 0 ? (
        <EmptyCard
          icon="shield-checkmark-outline"
          title="Nenhum admin encontrado"
          text="Não há administradores com essa busca."
        />
      ) : (
        admins.map((user) => (
          <UserCard key={user.id} user={user} onPress={() => onOpenUser(user)} />
        ))
      )}
    </>
  );
}

function RulesSection({
  loading,
  totalRules,
  users,
  search,
  ruleFilter,
  onChangeSearch,
  onChangeRuleFilter,
  onOpenUser,
}: {
  loading: boolean;
  totalRules: number;
  users: AdminUser[];
  search: string;
  ruleFilter: RuleFilter;
  onChangeSearch: (value: string) => void;
  onChangeRuleFilter: (value: RuleFilter) => void;
  onOpenUser: (user: AdminUser) => void;
}) {
  return (
    <>
      <View style={styles.singleSummaryCard}>
        <View
          style={[
            styles.singleSummaryIcon,
            { backgroundColor: 'rgba(192,132,252,0.12)' },
          ]}
        >
          <Ionicons name="options-outline" size={24} color="#C084FC" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.singleSummaryLabel}>Usuários com regras</Text>
          <Text style={styles.singleSummaryValue}>{totalRules}</Text>
        </View>
      </View>

      <HorizontalFilterTabs
        tabs={ruleTabs}
        value={ruleFilter}
        onChange={onChangeRuleFilter}
      />

      <SearchBox
        value={search}
        onChangeText={onChangeSearch}
        placeholder="Buscar usuários com regra"
      />

      <SectionTitle
        title="Regras aplicadas"
        subtitle={`${users.length} usuário(s) encontrado(s)`}
      />

      {loading ? (
        <LoadingCard />
      ) : users.length === 0 ? (
        <EmptyCard
          icon="options-outline"
          title="Nenhuma regra encontrada"
          text="Usuários com plano gratuito, desconto ou regra personalizada aparecerão aqui."
        />
      ) : (
        users.map((user) => (
          <RuleUserCard key={user.id} user={user} onPress={() => onOpenUser(user)} />
        ))
      )}
    </>
  );
}

function StatusTabs({
  value,
  onChange,
}: {
  value: AdminStatusFilter;
  onChange: (value: AdminStatusFilter) => void;
}) {
  return (
    <HorizontalFilterTabs
      tabs={statusTabs}
      value={value}
      onChange={onChange}
    />
  );
}

function HorizontalFilterTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; icon: IconName }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.statusTabs}
    >
      {tabs.map((item) => {
        const selected = value === item.id;

        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.85}
            style={[styles.statusTab, selected && styles.statusTabActive]}
            onPress={() => onChange(item.id)}
          >
            <Ionicons
              name={item.icon}
              size={17}
              color={selected ? '#080808' : '#9B969B'}
            />
            <Text
              style={[
                styles.statusTabText,
                selected && styles.statusTabTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function SearchBox({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchBox}>
      <Ionicons name="search-outline" size={20} color="#8F8A91" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8F8A91"
        style={styles.searchInput}
      />
      {!!value && (
        <TouchableOpacity onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={20} color="#8F8A91" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
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
  icon: IconName;
  color: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>

      <View style={styles.summaryCenterContent}>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

function UserCard({
  user,
  onPress,
}: {
  user: AdminUser;
  onPress: () => void;
}) {
  const status = getUserStatusInfo(user);
  const name = getAdminUserDisplayName(user);
  const rule = getUserRuleInfo(user);
  const username = user.username ? `@${user.username}` : user.email || 'E-mail não informado';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={styles.userCard}
      onPress={onPress}
    >
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={styles.userAvatar} />
      ) : (
        <View style={styles.userAvatarFallback}>
          <Ionicons name="person" size={20} color="#F5F0E6" />
        </View>
      )}

      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName} numberOfLines={1}>{name}</Text>

          {user.is_admin ? (
            <View style={styles.adminMiniBadge}>
              <Ionicons name="shield-checkmark-outline" size={12} color="#60A5FA" />
            </View>
          ) : null}
        </View>

        <Text style={styles.userMeta} numberOfLines={1}>{username}</Text>
        <Text style={styles.userMetaMuted} numberOfLines={1}>
          {getUserCityLabel(user)}
        </Text>

        {rule ? (
          <Text style={[styles.userRuleText, { color: rule.color }]} numberOfLines={1}>
            {rule.title}
          </Text>
        ) : null}
      </View>

      <View style={styles.userRightColumn}>
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

        <Ionicons name="chevron-forward" size={18} color="#8F8A91" />
      </View>
    </TouchableOpacity>
  );
}

function RuleUserCard({
  user,
  onPress,
}: {
  user: AdminUser;
  onPress: () => void;
}) {
  const rule = getUserRuleInfo(user);

  if (!rule) return null;

  return (
    <View style={styles.ruleCard}>
      <UserCard user={user} onPress={onPress} />

      <View style={[styles.ruleBox, { backgroundColor: rule.backgroundColor }]}>
        <View style={styles.ruleTopRow}>
          <Ionicons name={rule.icon} size={18} color={rule.color} />
          <Text style={[styles.ruleTitle, { color: rule.color }]}>
            {rule.title}
          </Text>
        </View>

        <Text style={styles.ruleDescription}>{rule.description}</Text>

        {rule.endsAt ? (
          <Text style={styles.ruleFooter}>
            Válido até {formatDate(rule.endsAt)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function UserDetailsModal({
  visible,
  user,
  actionLoading,
  onClose,
  onAlterDueDate,
  onApplyDiscount,
  onRemoveDiscount,
  onToggleAdmin,
  onToggleFreePlan,
}: {
  visible: boolean;
  user: AdminUser | null;
  actionLoading: boolean;
  onClose: () => void;
  onAlterDueDate: (user: AdminUser) => void;
  onApplyDiscount: (user: AdminUser) => void;
  onRemoveDiscount: (user: AdminUser) => void;
  onToggleAdmin: (user: AdminUser) => void;
  onToggleFreePlan: (user: AdminUser) => void;
}) {
  if (!user) return null;

  const name = getAdminUserDisplayName(user);
  const status = getUserStatusInfo(user);
  const dueDate = getUserDueDateInfo(user);
  const rule = getUserRuleInfo(user);
  const discountRule = getUserDiscountRuleInfo(user);
  const isFreePlan = getUserIsFreePlan(user);
  const blockingRule = getUserBlockingRule(user);
  const hasDiscountRule = Boolean(discountRule);
  const hasAdminRule = Boolean(user.is_admin);

  const canChangeDueDate = !blockingRule;
  const canApplyDiscount = !isFreePlan && !hasAdminRule;
  const canRemoveDiscount = hasDiscountRule && !isFreePlan && !hasAdminRule;
  const canToggleAdmin = user.is_admin ? true : !isFreePlan && !hasDiscountRule;
  const canToggleFreePlan = !hasAdminRule && !hasDiscountRule;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.userDetailsModal}>
          <View style={styles.modalHeader}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.modalAvatar} />
            ) : (
              <View style={styles.modalAvatarFallback}>
                <Ionicons name="person" size={26} color="#F5F0E6" />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.modalEyebrow}>Detalhes do usuário</Text>
              <Text style={styles.modalTitle} numberOfLines={2}>{name}</Text>
              {user.username ? (
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  @{user.username}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.modalCloseButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={22} color="#F5F0E6" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContent}
          >
            <View style={styles.modalStatusRow}>
              <View
                style={[
                  styles.modalStatusPill,
                  {
                    backgroundColor: status.backgroundColor,
                    borderColor: status.borderColor,
                  },
                ]}
              >
                <Ionicons name={status.icon} size={16} color={status.color} />
                <Text style={[styles.modalStatusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>

              {isNewAdminUser(user) ? (
                <View style={styles.modalNewPill}>
                  <Ionicons name="sparkles-outline" size={15} color="#FACC15" />
                  <Text style={styles.modalNewPillText}>Novo usuário</Text>
                </View>
              ) : null}

              {user.is_admin ? (
                <View style={styles.modalAdminPill}>
                  <Ionicons name="shield-checkmark-outline" size={15} color="#60A5FA" />
                  <Text style={styles.modalAdminPillText}>Admin</Text>
                </View>
              ) : null}
            </View>

            {discountRule ? (
              <View style={styles.discountAppliedBox}>
                <View style={styles.discountAppliedIcon}>
                  <Ionicons name="pricetag-outline" size={20} color="#FACC15" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.discountAppliedTitle}>Promoção aplicada</Text>
                  <Text style={styles.discountAppliedText}>{discountRule.title}</Text>
                  <Text style={styles.discountAppliedDescription}>
                    {discountRule.description}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.adminActionsBox}>
              <Text style={styles.adminActionsTitle}>Ações administrativas</Text>

              {blockingRule ? (
                <View style={styles.exclusiveRuleWarning}>
                  <Ionicons name="lock-closed-outline" size={18} color="#FACC15" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exclusiveRuleWarningTitle}>
                      {blockingRule.title}
                    </Text>
                    <Text style={styles.exclusiveRuleWarningText}>
                      {blockingRule.message}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.adminActionsGrid}>
                <AdminActionButton
                  icon="calendar-outline"
                  title="Alterar vencimento"
                  subtitle={canChangeDueDate ? 'Definir nova data' : 'Bloqueado'}
                  disabled={actionLoading || !canChangeDueDate}
                  onPress={() =>
                    canChangeDueDate
                      ? onAlterDueDate(user)
                      : showBlockedAdminActionAlert(user)
                  }
                />

                <AdminActionButton
                  icon="pricetag-outline"
                  title={discountRule ? 'Editar desconto' : 'Dar desconto'}
                  subtitle={
                    hasAdminRule
                      ? 'Bloqueado por admin'
                      : isFreePlan
                        ? 'Bloqueado por gratuito'
                        : discountRule?.title || 'Valor ou porcentagem'
                  }
                  disabled={actionLoading || !canApplyDiscount}
                  onPress={() =>
                    canApplyDiscount
                      ? onApplyDiscount(user)
                      : showBlockedAdminActionAlert(user)
                  }
                />

                {discountRule ? (
                  <AdminActionButton
                    icon="trash-outline"
                    title="Remover desconto"
                    subtitle="Liberar outras funções"
                    danger
                    disabled={actionLoading || !canRemoveDiscount}
                    onPress={() =>
                      canRemoveDiscount
                        ? onRemoveDiscount(user)
                        : showBlockedAdminActionAlert(user)
                    }
                  />
                ) : null}

                <AdminActionButton
                  icon={user.is_admin ? 'shield-outline' : 'shield-checkmark-outline'}
                  title={user.is_admin ? 'Remover admin' : 'Definir admin'}
                  subtitle={
                    user.is_admin
                      ? 'Vencimento +10 dias'
                      : canToggleAdmin
                        ? 'Gratuito padrão'
                        : 'Bloqueado'
                  }
                  danger={Boolean(user.is_admin)}
                  disabled={actionLoading || !canToggleAdmin}
                  onPress={() =>
                    canToggleAdmin
                      ? onToggleAdmin(user)
                      : showBlockedAdminActionAlert(user)
                  }
                />

                <AdminActionButton
                  icon={isFreePlan ? 'close-circle-outline' : 'gift-outline'}
                  title={isFreePlan ? 'Remover gratuito' : 'Plano gratuito'}
                  subtitle={
                    isFreePlan
                      ? 'Vencimento +10 dias'
                      : canToggleFreePlan
                        ? 'Não paga mensalidade'
                        : 'Bloqueado'
                  }
                  danger={isFreePlan && !user.is_admin}
                  disabled={actionLoading || !canToggleFreePlan}
                  onPress={() =>
                    canToggleFreePlan
                      ? onToggleFreePlan(user)
                      : showBlockedAdminActionAlert(user)
                  }
                />
              </View>
            </View>

            <DetailRow icon="mail-outline" label="E-mail" value={user.email || 'Não informado'} />
            <DetailRow icon="person-outline" label="Username" value={user.username ? `@${user.username}` : 'Não informado'} />
            <DetailRow icon="location-outline" label="Cidade" value={getUserCityLabel(user)} />
            <DetailRow icon="calendar-outline" label="Criado em" value={formatDate(user.created_at)} />
            <DetailRow
              icon={dueDate.icon}
              label={isFreePlan ? "Vencimento" : "Vencimento da assinatura"}
              value={dueDate.label}
              valueColor={dueDate.color}
            />
            <DetailRow icon="card-outline" label="Status da assinatura" value={user.subscription_status || 'Não informado'} />
            <DetailRow icon="finger-print-outline" label="ID do usuário" value={user.id} />

            {rule ? (
              <View style={[styles.modalRuleBox, { backgroundColor: rule.backgroundColor }]}>
                <View style={styles.ruleTopRow}>
                  <Ionicons name={rule.icon} size={18} color={rule.color} />
                  <Text style={[styles.ruleTitle, { color: rule.color }]}>
                    {rule.title}
                  </Text>
                </View>

                <Text style={styles.ruleDescription}>{rule.description}</Text>

                {rule.endsAt ? (
                  <Text style={styles.ruleFooter}>
                    Válido até {formatDate(rule.endsAt)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AdminActionButton({
  icon,
  title,
  subtitle,
  danger,
  disabled,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[
        styles.adminActionButton,
        danger && styles.adminActionButtonDanger,
        disabled && styles.adminActionButtonDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={19}
        color={danger ? '#FCA5A5' : '#D4A64A'}
      />

      <Text
        style={[
          styles.adminActionButtonTitle,
          danger && styles.adminActionButtonTitleDanger,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>

      <Text style={styles.adminActionButtonSubtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function DueDateActionModal({
  visible,
  value,
  loading,
  user,
  onChangeText,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  value: string;
  loading: boolean;
  user: AdminUser | null;
  onChangeText: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.actionModalCard}>
          <View style={styles.actionModalIcon}>
            <Ionicons name="calendar-outline" size={26} color="#D4A64A" />
          </View>

          <Text style={styles.actionModalTitle}>Alterar vencimento</Text>
          <Text style={styles.actionModalText}>
            Defina o novo vencimento de {user ? getAdminUserDisplayName(user) : 'usuário'}.
          </Text>

          <Text style={styles.actionInputLabel}>Novo vencimento</Text>

          <View style={styles.actionInputBox}>
            <Ionicons name="calendar-outline" size={20} color="#D4A64A" />
            <TextInput
              value={value}
              onChangeText={onChangeText}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#8F8A91"
              keyboardType="numeric"
              style={styles.actionInput}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.actionPrimaryButton, loading && styles.actionButtonDisabled]}
            disabled={loading}
            onPress={onConfirm}
          >
            {loading ? (
              <ActivityIndicator color="#080808" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#080808" />
                <Text style={styles.actionPrimaryButtonText}>Salvar vencimento</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.actionSecondaryButton}
            disabled={loading}
            onPress={onClose}
          >
            <Text style={styles.actionSecondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function DiscountActionModal({
  visible,
  discountType,
  discountValue,
  loading,
  user,
  onChangeDiscountType,
  onChangeDiscountValue,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  discountType: DiscountType;
  discountValue: string;
  loading: boolean;
  user: AdminUser | null;
  onChangeDiscountType: (value: DiscountType) => void;
  onChangeDiscountValue: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const editing = Boolean(getUserDiscountRuleInfo(user));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.actionModalCard}>
          <View style={styles.actionModalIcon}>
            <Ionicons name="pricetag-outline" size={26} color="#D4A64A" />
          </View>

          <Text style={styles.actionModalTitle}>
            {editing ? 'Editar desconto' : 'Dar desconto'}
          </Text>
          <Text style={styles.actionModalText}>
            {editing
              ? `Altere o desconto aplicado para ${user ? getAdminUserDisplayName(user) : 'usuário'}.`
              : `Aplique desconto para ${user ? getAdminUserDisplayName(user) : 'usuário'}.`}
          </Text>

          <View style={styles.discountTypeRow}>
            <TouchableOpacity
              activeOpacity={0.86}
              style={[
                styles.discountTypeButton,
                discountType === 'percentage' && styles.discountTypeButtonActive,
              ]}
              onPress={() => onChangeDiscountType('percentage')}
            >
              <Text
                style={[
                  styles.discountTypeText,
                  discountType === 'percentage' && styles.discountTypeTextActive,
                ]}
              >
                Porcentagem
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              style={[
                styles.discountTypeButton,
                discountType === 'amount' && styles.discountTypeButtonActive,
              ]}
              onPress={() => onChangeDiscountType('amount')}
            >
              <Text
                style={[
                  styles.discountTypeText,
                  discountType === 'amount' && styles.discountTypeTextActive,
                ]}
              >
                Valor
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.actionInputLabel}>
            {discountType === 'percentage' ? 'Porcentagem de desconto' : 'Valor de desconto'}
          </Text>

          <View style={styles.actionInputBox}>
            <Ionicons
              name={discountType === 'percentage' ? 'analytics-outline' : 'cash-outline'}
              size={20}
              color="#D4A64A"
            />
            <TextInput
              value={discountValue}
              onChangeText={onChangeDiscountValue}
              placeholder={discountType === 'percentage' ? 'Ex: 50' : 'Ex: 19,90'}
              placeholderTextColor="#8F8A91"
              keyboardType="decimal-pad"
              style={styles.actionInput}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.actionPrimaryButton, loading && styles.actionButtonDisabled]}
            disabled={loading}
            onPress={onConfirm}
          >
            {loading ? (
              <ActivityIndicator color="#080808" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#080808" />
                <Text style={styles.actionPrimaryButtonText}>
                  {editing ? 'Salvar desconto' : 'Aplicar desconto'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.actionSecondaryButton}
            disabled={loading}
            onPress={onClose}
          >
            <Text style={styles.actionSecondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: IconName;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color="#D4A64A" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function LoadingCard() {
  return (
    <View style={styles.feedbackCard}>
      <ActivityIndicator color="#D4A64A" />
      <Text style={styles.feedbackText}>Carregando dados...</Text>
    </View>
  );
}

function EmptyCard({
  icon,
  title,
  text,
}: {
  icon: IconName;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.feedbackCard}>
      <Ionicons name={icon} size={30} color="#8F8A91" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.feedbackText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  exclusiveRuleWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(250,204,21,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.22)',
    marginBottom: 12,
  },
  exclusiveRuleWarningTitle: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  exclusiveRuleWarningText: {
    color: '#E7D8A6',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },

  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 132,
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
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
    zIndex: 50,
    elevation: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  configButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerEyebrow: {
    color: '#D4A64A',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.7,
  },
  headerTitle: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  headerSubtitle: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  summaryCard: {
    width: '48.7%',
    minHeight: 78,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  summaryCompactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCenterContent: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 10,
    left: 10,
  },
  summaryLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  summaryValue: {
    color: '#F5F0E6',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  singleSummaryCard: {
    minHeight: 88,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 14,
  },
  singleSummaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleSummaryLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
  },
  singleSummaryValue: {
    color: '#F5F0E6',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  singleSummaryHint: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  statusTabs: {
    gap: 8,
    paddingBottom: 12,
  },
  statusTab: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusTabActive: {
    backgroundColor: '#D4A64A',
    borderColor: '#D4A64A',
  },
  statusTabText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '900',
  },
  statusTabTextActive: {
    color: '#080808',
  },
  searchBox: {
    height: 52,
    borderRadius: 15,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  backToCitiesButton: {
    minHeight: 42,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  backToCitiesButtonText: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },
  cityCard: {
    minHeight: 78,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 10,
  },
  cityRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityRankText: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
  },
  cityIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },
  cityUf: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  cityCountBox: {
    alignItems: 'flex-end',
  },
  cityCountValue: {
    color: '#D4A64A',
    fontSize: 19,
    fontWeight: '900',
  },
  cityCountLabel: {
    color: '#8F8A91',
    fontSize: 10,
    fontWeight: '800',
  },
  userCard: {
    minHeight: 76,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 10,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
  },
  userAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  userName: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  adminMiniBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newUserMiniBadge: {
    minHeight: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.25)',
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newUserMiniBadgeText: {
    color: '#FACC15',
    fontSize: 9,
    fontWeight: '900',
  },
  userMeta: {
    color: '#B8B1B8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  userMetaMuted: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  userRuleText: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 3,
  },
  userRightColumn: {
    alignItems: 'flex-end',
    gap: 8,
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
  ruleCard: {
    marginBottom: 12,
  },
  ruleBox: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.08)',
    padding: 11,
    marginTop: -2,
  },
  ruleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  ruleDescription: {
    color: '#B8B1B8',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 6,
  },
  ruleFooter: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 7,
  },
  feedbackCard: {
    minHeight: 160,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
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
  bottomMenuWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: 'rgba(5,5,5,0.94)',
    borderTopWidth: 1,
    borderTopColor: '#211D16',
  },
  bottomMenu: {
    minHeight: 68,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 22,
    padding: 6,
    flexDirection: 'row',
    gap: 5,
  },
  bottomMenuItem: {
    flex: 1,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bottomMenuItemActive: {
    backgroundColor: '#D4A64A',
  },
  bottomMenuText: {
    color: '#9B969B',
    fontSize: 10,
    fontWeight: '900',
  },
  bottomMenuTextActive: {
    color: '#080808',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  userDetailsModal: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#101014',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  modalAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  modalAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEyebrow: {
    color: '#D4A64A',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  modalTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  modalSubtitle: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingBottom: 6,
  },
  modalStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  modalStatusPill: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalStatusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  modalNewPill: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.25)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalNewPillText: {
    color: '#FACC15',
    fontSize: 11,
    fontWeight: '900',
  },
  modalAdminPill: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.25)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalAdminPillText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '900',
  },
  discountAppliedBox: {
    backgroundColor: 'rgba(250,204,21,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.24)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  discountAppliedIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountAppliedTitle: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discountAppliedText: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  discountAppliedDescription: {
    color: '#B8B1B8',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 3,
  },
  adminActionsBox: {
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  adminActionsTitle: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  adminActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminActionButton: {
    width: '48.6%',
    minHeight: 82,
    borderRadius: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    padding: 10,
    justifyContent: 'center',
    gap: 4,
  },
  adminActionButtonDanger: {
    borderColor: 'rgba(239,68,68,0.28)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  adminActionButtonDisabled: {
    opacity: 0.45,
  },
  adminActionButtonTitle: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
  },
  adminActionButtonTitleDanger: {
    color: '#FCA5A5',
  },
  adminActionButtonSubtitle: {
    color: '#9B969B',
    fontSize: 10,
    fontWeight: '800',
  },
  detailRow: {
    minHeight: 58,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    color: '#8F8A91',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  modalRuleBox: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.08)',
    padding: 12,
    marginTop: 2,
  },
  actionModalCard: {
    width: '100%',
    backgroundColor: '#101014',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 18,
    alignItems: 'center',
  },
  actionModalIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionModalTitle: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  actionModalText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  actionInputLabel: {
    width: '100%',
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
  },
  actionInputBox: {
    width: '100%',
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  actionInput: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '800',
    minHeight: 50,
  },
  discountTypeRow: {
    width: '100%',
    minHeight: 48,
    backgroundColor: '#18171D',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 5,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  discountTypeButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountTypeButtonActive: {
    backgroundColor: '#D4A64A',
  },
  discountTypeText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '900',
  },
  discountTypeTextActive: {
    color: '#080808',
  },
  actionPrimaryButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.65,
  },
  actionPrimaryButtonText: {
    color: '#080808',
    fontSize: 14,
    fontWeight: '900',
  },
  actionSecondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  actionSecondaryButtonText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '900',
  },
});
