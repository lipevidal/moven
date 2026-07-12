import { supabase } from '../../../database/supabase';
import { requireCurrentUserAdmin } from './adminAccess';

export type AdminStatusFilter = 'all' | 'new' | 'active' | 'inactive';

export type AdminUserRule = {
  id?: string | null;
  user_id?: string | null;
  rule_type?: string | null;
  type?: string | null;
  label?: string | null;
  description?: string | null;
  discount_type?: string | null;
  discount_value?: number | string | null;
  discount_percent?: number | string | null;
  discount_percentage?: number | string | null;
  is_active?: boolean | null;
  is_free_plan?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string | null;
};

export type AdminUser = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  is_admin?: boolean | null;
  is_active?: boolean | null;
  subscription_status?: string | null;
  subscription_due_at?: string | null;
  has_subscription_payment?: boolean | null;
  subscription_payment_count?: number | null;
  last_payment_at?: string | null;
  municipality_id?: string | null;
  default_municipality_id?: string | null;
  subscription_rule?: AdminUserRule | null;
  municipality?: {
    id: string;
    name: string;
    uf: string;
  } | null;
};

export type AdminCity = {
  id: string;
  name: string;
  uf: string;
  users_count: number;
};

type RawRecord = Record<string, any>;

function normalize(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeStatus(value?: string | null) {
  return normalize(value).replace(/\s+/g, '_');
}

function normalizeMunicipality(value: unknown): AdminUser['municipality'] {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw || typeof raw !== 'object') return null;

  const item = raw as RawRecord;

  if (!item.id) return null;

  return {
    id: String(item.id),
    name: String(item.name ?? ''),
    uf: String(item.uf ?? ''),
  };
}

function getRawMunicipalityId(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw || typeof raw !== 'object') return null;

  return (raw as RawRecord).id ? String((raw as RawRecord).id) : null;
}

export function getAdminUserDisplayName(user: AdminUser) {
  return user.full_name || user.name || user.username || user.email || 'Usuário sem nome';
}


function parseAdminDateWithoutTimezone(value?: string | null) {
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
      date.setHours(0, 0, 0, 0);
      return date;
    }
  }

  const fallback = new Date(raw);

  if (Number.isNaN(fallback.getTime())) return null;

  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

function getAdminTodayDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getAdminUserDueDate(user: AdminUser) {
  const anyUser = user as any;

  return (
    user.subscription_due_at ||
    anyUser.current_period_end ||
    anyUser.subscription_current_period_end ||
    anyUser.due_date ||
    anyUser.plan_due_at ||
    null
  );
}

function normalizeAdminStatus(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getAdminUserStatusText(user: AdminUser) {
  const anyUser = user as any;

  return normalizeAdminStatus(
    user.subscription_status ||
      anyUser.status ||
      anyUser.plan_status ||
      '',
  );
}

function isPaidSubscriptionStatus(status?: string | null) {
  const normalized = normalizeAdminStatus(status);

  return [
    'paid',
    'received',
    'confirmed',
    'payment_received',
    'payment_confirmed',
    'received_in_cash',
    'approved',
    'success',
    'active',
  ].includes(normalized);
}

function getAdminUserRule(user: AdminUser) {
  const anyUser = user as any;

  return (
    anyUser.subscription_rule ||
    anyUser.user_subscription_rule ||
    anyUser.rule ||
    null
  );
}

function userHasFreePlan(user: AdminUser) {
  const anyUser = user as any;
  const rule = getAdminUserRule(user) as any;

  const rawType = normalizeAdminStatus(
    rule?.rule_type ||
      rule?.type ||
      anyUser.rule_type ||
      anyUser.subscription_rule_type ||
      anyUser.plan_rule_type ||
      anyUser.plan_type ||
      '',
  );

  return (
    Boolean(user.is_admin) ||
    Boolean(rule?.is_free_plan) ||
    Boolean(anyUser.is_free_plan) ||
    Boolean(anyUser.has_free_plan) ||
    rawType.includes('admin_free') ||
    rawType.includes('free') ||
    rawType.includes('gratis') ||
    rawType.includes('gratuito') ||
    rawType.includes('plano_gratuito')
  );
}

function userIsInGracePeriod(user: AdminUser) {
  const anyUser = user as any;
  const status = getAdminUserStatusText(user);

  return (
    status === 'trial' ||
    status === 'grace' ||
    status === 'grace_period' ||
    status === 'carencia' ||
    status === 'periodo_de_carencia' ||
    status === 'periodo de carencia' ||
    Boolean(anyUser.is_trial) ||
    Boolean(anyUser.in_trial) ||
    Boolean(anyUser.is_grace_period) ||
    Boolean(anyUser.in_grace_period)
  );
}

function userDueDateHasPassed(user: AdminUser) {
  const dueDate = parseAdminDateWithoutTimezone(getAdminUserDueDate(user));

  if (!dueDate) return false;

  return dueDate.getTime() < getAdminTodayDate().getTime();
}

function userDueDateHasNotArrived(user: AdminUser) {
  const dueDate = parseAdminDateWithoutTimezone(getAdminUserDueDate(user));

  if (!dueDate) return false;

  return dueDate.getTime() >= getAdminTodayDate().getTime();
}

export function isNewAdminUser(user: AdminUser) {
  /*
    Novo = todos que estão no período de carência.
  */
  if (userDueDateHasPassed(user)) return false;

  return userIsInGracePeriod(user);
}

export function isActiveAdminUser(user: AdminUser) {
  /*
    Ativo =
    1. todos os administradores;
    2. todos os planos gratuitos;
    3. usuários dentro do prazo de vencimento e fora da carência.
  */
  if (userHasFreePlan(user)) return true;
  if (userDueDateHasPassed(user)) return false;
  if (userIsInGracePeriod(user)) return false;

  return userDueDateHasNotArrived(user);
}

export function isInactiveAdminUser(user: AdminUser) {
  /*
    Inativo = quem já extrapolou/passou da data de vencimento.
    Admin e plano gratuito não entram como inativos.
  */
  if (userHasFreePlan(user)) return false;

  return userDueDateHasPassed(user);
}

function matchesStatus(user: AdminUser, filter: AdminStatusFilter) {
  if (filter === 'new') return isNewAdminUser(user);
  if (filter === 'active') return isActiveAdminUser(user);
  if (filter === 'inactive') return isInactiveAdminUser(user);

  return true;
}

function matchesSearch(user: AdminUser, search?: string) {
  const term = normalize(search);

  if (!term) return true;

  const city = user.municipality
    ? `${user.municipality.name} ${user.municipality.uf}`
    : '';

  return [
    user.full_name,
    user.name,
    user.username,
    user.email,
    user.subscription_status,
    city,
  ].some((item) => normalize(item).includes(term));
}

function matchesCitySearch(city: AdminCity, search?: string) {
  const term = normalize(search);

  if (!term) return true;

  return normalize(`${city.name} ${city.uf}`).includes(term);
}

async function fetchProfiles() {
  const selectCandidates = [
    `
      id,
      full_name,
      name,
      username,
      email,
      avatar_url,
      created_at,
      is_admin,
      is_active,
      subscription_status,
      subscription_due_at,
      municipality_id,
      default_municipality_id,
      municipality:municipalities(id, name, uf)
    `,
    `
      id,
      full_name,
      name,
      username,
      email,
      avatar_url,
      created_at,
      is_admin,
      is_active,
      subscription_status,
      municipality_id,
      default_municipality_id,
      municipality:municipalities(id, name, uf)
    `,
    `
      id,
      full_name,
      name,
      email,
      avatar_url,
      created_at,
      is_admin,
      is_active,
      subscription_status,
      municipality_id,
      municipality:municipalities(id, name, uf)
    `,
    `
      id,
      full_name,
      name,
      username,
      email,
      avatar_url,
      created_at,
      is_admin,
      is_active,
      subscription_status,
      subscription_due_at,
      municipality_id,
      default_municipality_id
    `,
    `
      id,
      full_name,
      name,
      email,
      avatar_url,
      created_at,
      is_admin,
      is_active,
      subscription_status,
      municipality_id
    `,
    `
      id,
      full_name,
      name,
      email,
      avatar_url,
      created_at,
      is_admin
    `,
  ];

  let lastError: unknown = null;

  for (const select of selectCandidates) {
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select(select)
      .order('created_at', { ascending: true });

    if (!error) {
      return (data ?? []) as RawRecord[];
    }

    lastError = error;
    console.log('Tentativa de buscar profiles falhou:', error?.message ?? error);
  }

  throw lastError ?? new Error('Não foi possível buscar usuários.');
}

async function fetchUserSubscriptions() {
  const selectCandidates = [
    'user_id, status, current_period_end, last_payment_at',
    'user_id, status, current_period_end',
  ];

  for (const select of selectCandidates) {
    const { data, error } = await (supabase as any)
      .from('user_subscriptions')
      .select(select);

    if (!error) {
      return ((data ?? []) as RawRecord[]).reduce<Record<string, RawRecord>>(
        (acc, item) => {
          if (item.user_id) {
            acc[String(item.user_id)] = item;
          }

          return acc;
        },
        {},
      );
    }

    console.log('Tabela user_subscriptions indisponível:', error.message);
  }

  return {} as Record<string, RawRecord>;
}

async function fetchPaidPaymentsByUser() {
  const selectCandidates = [
    'user_id, status, paid_at, confirmed_at, created_at',
    'user_id, status, paid_at, created_at',
    'user_id, status, created_at',
    'user_id, status',
  ];

  for (const select of selectCandidates) {
    const { data, error } = await (supabase as any)
      .from('subscription_payments')
      .select(select);

    if (!error) {
      return ((data ?? []) as RawRecord[]).reduce<
        Record<string, { count: number; lastPaymentAt: string | null }>
      >((acc, payment) => {
        const userId = payment.user_id ? String(payment.user_id) : '';

        if (!userId || !isPaidSubscriptionStatus(payment.status)) {
          return acc;
        }

        const paymentDate = String(
          payment.paid_at ||
            payment.confirmed_at ||
            payment.created_at ||
            '',
        );

        if (!acc[userId]) {
          acc[userId] = {
            count: 0,
            lastPaymentAt: null,
          };
        }

        acc[userId].count += 1;

        if (paymentDate) {
          const currentDate = acc[userId].lastPaymentAt;

          if (!currentDate || new Date(paymentDate).getTime() > new Date(currentDate).getTime()) {
            acc[userId].lastPaymentAt = paymentDate;
          }
        }

        return acc;
      }, {});
    }

    console.log('Tentativa de buscar pagamentos falhou:', error.message);
  }

  return {} as Record<string, { count: number; lastPaymentAt: string | null }>;
}


async function fetchMunicipalitiesByIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (uniqueIds.length === 0) return {} as Record<string, AdminUser['municipality']>;

  const { data, error } = await (supabase as any)
    .from('municipalities')
    .select('id, name, uf')
    .in('id', uniqueIds);

  if (error) {
    console.log('Não foi possível buscar municipalities:', error.message);
    return {} as Record<string, AdminUser['municipality']>;
  }

  return ((data ?? []) as RawRecord[]).reduce<Record<string, AdminUser['municipality']>>(
    (acc, item) => {
      if (item.id) {
        acc[String(item.id)] = {
          id: String(item.id),
          name: String(item.name ?? ''),
          uf: String(item.uf ?? ''),
        };
      }

      return acc;
    },
    {},
  );
}

async function fetchLatestSessionCities() {
  const withRelation = await (supabase as any)
    .from('work_sessions')
    .select(
      `
        user_id,
        municipality_id,
        started_at,
        municipality:municipalities(id, name, uf)
      `,
    )
    .not('municipality_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(5000);

  if (!withRelation.error) {
    return ((withRelation.data ?? []) as RawRecord[]).map((session) => ({
      user_id: session.user_id,
      municipality_id: session.municipality_id,
      municipality: normalizeMunicipality(session.municipality),
    }));
  }

  const flat = await (supabase as any)
    .from('work_sessions')
    .select('user_id, municipality_id, started_at')
    .not('municipality_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(5000);

  if (flat.error) {
    console.log('Busca de cidades por sessões falhou:', flat.error.message);
    return [] as RawRecord[];
  }

  const municipalityIds = ((flat.data ?? []) as RawRecord[])
    .map((item) => String(item.municipality_id ?? ''))
    .filter(Boolean);

  const municipalityById = await fetchMunicipalitiesByIds(municipalityIds);

  return ((flat.data ?? []) as RawRecord[]).map((session) => ({
    user_id: session.user_id,
    municipality_id: session.municipality_id,
    municipality: municipalityById[String(session.municipality_id)] ?? null,
  }));
}

async function fetchUserRules() {
  const selectCandidates = [
    `
      id,
      user_id,
      rule_type,
      label,
      description,
      discount_type,
      discount_value,
      discount_percent,
      discount_percentage,
      is_active,
      is_free_plan,
      starts_at,
      ends_at,
      created_at
    `,
    `
      id,
      user_id,
      rule_type,
      label,
      description,
      discount_type,
      discount_value,
      discount_percent,
      is_active,
      is_free_plan,
      starts_at,
      ends_at,
      created_at
    `,
    `
      id,
      user_id,
      rule_type,
      label,
      description,
      discount_percent,
      is_active,
      is_free_plan,
      starts_at,
      ends_at,
      created_at
    `,
    `
      id,
      user_id,
      rule_type,
      label,
      description,
      is_active,
      is_free_plan,
      starts_at,
      ends_at,
      created_at
    `,
  ];

  for (const select of selectCandidates) {
    const { data, error } = await (supabase as any)
      .from('user_subscription_rules')
      .select(select)
      .or('is_active.is.null,is_active.eq.true')
      .order('created_at', { ascending: false });

    if (!error) {
      return (data ?? []) as AdminUserRule[];
    }

    console.log('Tentativa de buscar regras falhou:', error.message);
  }

  return [] as AdminUserRule[];
}

export async function getAdminUsers(params?: {
  statusFilter?: AdminStatusFilter;
  search?: string;
  cityId?: string;
}) {
  await requireCurrentUserAdmin();

  const statusFilter = params?.statusFilter ?? 'all';

  const [
    profiles,
    subscriptionsByUser,
    paidPaymentsByUser,
    latestSessions,
    rules,
  ] = await Promise.all([
    fetchProfiles(),
    fetchUserSubscriptions(),
    fetchPaidPaymentsByUser(),
    fetchLatestSessionCities(),
    fetchUserRules(),
  ]);

  const latestCityByUser = (latestSessions as RawRecord[]).reduce<
    Record<string, AdminUser['municipality']>
  >((acc, session) => {
    const userId = session.user_id ? String(session.user_id) : '';

    if (userId && !acc[userId]) {
      acc[userId] = normalizeMunicipality(session.municipality);
    }

    return acc;
  }, {});

  const ruleByUser = rules.reduce<Record<string, AdminUserRule>>((acc, rule) => {
    if (rule.user_id && !acc[String(rule.user_id)]) {
      acc[String(rule.user_id)] = rule;
    }

    return acc;
  }, {});

  const municipalityIds = profiles
    .map((profile) => {
      return (
        profile.municipality_id ??
        profile.default_municipality_id ??
        getRawMunicipalityId(profile.municipality) ??
        ''
      );
    })
    .map(String)
    .filter(Boolean);

  const municipalityById = await fetchMunicipalitiesByIds(municipalityIds);

  const users = profiles.map<AdminUser>((profile) => {
    const userId = String(profile.id);
    const subscription = subscriptionsByUser[userId] ?? null;
    const paidPaymentInfo = paidPaymentsByUser[userId] ?? {
      count: 0,
      lastPaymentAt: null,
    };

    const profileMunicipalityId =
      profile.municipality_id ??
      profile.default_municipality_id ??
      getRawMunicipalityId(profile.municipality) ??
      null;

    const profileCity =
      normalizeMunicipality(profile.municipality) ??
      (profileMunicipalityId
        ? municipalityById[String(profileMunicipalityId)] ?? null
        : null);

    const latestCity = latestCityByUser[userId] ?? null;
    const municipality = profileCity ?? latestCity;

    const subscriptionStatus =
      profile.subscription_status ??
      subscription?.status ??
      null;

    const subscriptionDueAt =
      profile.subscription_due_at ??
      subscription?.current_period_end ??
      null;

    const isActive =
      profile.is_active ??
      (subscriptionStatus
        ? ['trial', 'active', 'paid'].includes(normalizeStatus(subscriptionStatus))
        : null);

    return {
      id: userId,
      full_name: profile.full_name ?? null,
      name: profile.name ?? null,
      username: profile.username ?? null,
      email: profile.email ?? null,
      avatar_url: profile.avatar_url ?? null,
      created_at: profile.created_at ?? null,
      is_admin: Boolean(profile.is_admin),
      is_active: isActive,
      subscription_status: subscriptionStatus,
      subscription_due_at: subscriptionDueAt,
      has_subscription_payment:
        paidPaymentInfo.count > 0 || Boolean(subscription?.last_payment_at),
      subscription_payment_count: paidPaymentInfo.count,
      last_payment_at:
        paidPaymentInfo.lastPaymentAt ?? subscription?.last_payment_at ?? null,
      municipality_id: profileMunicipalityId ?? municipality?.id ?? null,
      default_municipality_id: profile.default_municipality_id ?? null,
      municipality,
      subscription_rule: ruleByUser[userId] ?? null,
    };
  });

  return users.filter(
    (user) =>
      (!params?.cityId || user.municipality?.id === params.cityId) &&
      matchesStatus(user, statusFilter) &&
      matchesSearch(user, params?.search),
  );
}

export async function getAdminCities(params?: {
  statusFilter?: AdminStatusFilter;
  search?: string;
}) {
  const users = await getAdminUsers({
    statusFilter: params?.statusFilter ?? 'all',
  });

  const grouped = users.reduce<Record<string, AdminCity>>((acc, user) => {
    const city = user.municipality;

    if (!city?.id) return acc;

    if (!acc[city.id]) {
      acc[city.id] = {
        id: city.id,
        name: city.name || 'Cidade sem nome',
        uf: city.uf || '--',
        users_count: 0,
      };
    }

    acc[city.id].users_count += 1;

    return acc;
  }, {});

  return Object.values(grouped)
    .filter((city) => matchesCitySearch(city, params?.search))
    .sort((a, b) => b.users_count - a.users_count);
}
