import { supabase } from '../../../database/supabase';
import { requireCurrentUserAdmin } from './adminAccess';

export type AdminStatusFilter = 'all' | 'new' | 'active' | 'inactive';

export type AdminUser = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  is_admin?: boolean | null;
  is_active?: boolean | null;
  subscription_status?: string | null;
  subscription_due_at?: string | null;
  municipality_id?: string | null;
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

type RawAdminUser = Omit<AdminUser, 'municipality'> & {
  default_municipality_id?: string | null;
};

function normalize(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getDateKeyFromValue(value?: string | Date | null) {
  if (!value) return null;

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  const textValue = String(value);
  const dateMatch = textValue.match(/^(\d{4}-\d{2}-\d{2})/);

  if (dateMatch) return dateMatch[1];

  const date = new Date(textValue);

  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getTodayDateKey() {
  return getDateKeyFromValue(new Date()) ?? '';
}

function getCreatedAtDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

async function refreshProfilesActiveStatus() {
  /*
    Essa RPC atualiza is_active e subscription_status de acordo com
    subscription_due_at >= current_date.

    Ela é criada pelo SQL enviado junto deste ajuste. Se ela ainda não existir,
    não travamos a tela; o filtro no app ainda usa a data de vencimento como fonte.
  */
  const { error } = await supabase.rpc('refresh_profiles_active_status');

  if (error) {
    console.log('Aviso ao sincronizar status dos usuários:', error);
  }
}

export function getAdminUserDisplayName(user: AdminUser) {
  return user.full_name || user.name || user.email || 'Usuário sem nome';
}

export function isNewAdminUser(user: AdminUser) {
  const createdAt = getCreatedAtDate(user.created_at);

  if (!createdAt) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tenDaysAgo = new Date(today);
  tenDaysAgo.setDate(today.getDate() - 10);

  return createdAt.getTime() >= tenDaysAgo.getTime();
}

export function isActiveAdminUser(user: AdminUser) {
  const dueDateKey = getDateKeyFromValue(user.subscription_due_at);

  if (dueDateKey) {
    return dueDateKey >= getTodayDateKey();
  }

  return user.is_active === true;
}

export function isInactiveAdminUser(user: AdminUser) {
  const dueDateKey = getDateKeyFromValue(user.subscription_due_at);

  if (dueDateKey) {
    return dueDateKey < getTodayDateKey();
  }

  return user.is_active === false;
}

function matchesStatusFilter(user: AdminUser, statusFilter: AdminStatusFilter) {
  if (statusFilter === 'new') return isNewAdminUser(user);
  if (statusFilter === 'active') return isActiveAdminUser(user);
  if (statusFilter === 'inactive') return isInactiveAdminUser(user);

  return true;
}

function matchesUserSearch(user: AdminUser, search?: string) {
  const term = normalize(search);

  if (!term) return true;

  const city = user.municipality
    ? `${user.municipality.name} ${user.municipality.uf}`
    : '';

  return [
    user.full_name,
    user.name,
    user.email,
    user.subscription_status,
    user.subscription_due_at,
    city,
  ].some((item) => normalize(item).includes(term));
}

function matchesCitySearch(city: AdminCity, search?: string) {
  const term = normalize(search);

  if (!term) return true;

  return normalize(`${city.name} ${city.uf}`).includes(term);
}

export async function getAdminUsers(params?: {
  statusFilter?: AdminStatusFilter;
  search?: string;
  cityId?: string;
}) {
  await requireCurrentUserAdmin();
  await refreshProfilesActiveStatus();

  const statusFilter = params?.statusFilter ?? 'all';

  /*
    Não usamos embed direto profiles -> municipalities.

    Sua tabela profiles possui duas FKs para municipalities:
    - profiles.municipality_id
    - profiles.default_municipality_id

    Por isso buscamos perfis, jornadas e cidades separadamente para evitar PGRST201.
  */
  const [{ data, error }, sessionsResponse] = await Promise.all([
    supabase
      .from('profiles')
      .select(
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
          subscription_due_at,
          municipality_id,
          default_municipality_id
        `,
      )
      .order('created_at', { ascending: true }),

    supabase
      .from('work_sessions')
      .select(
        `
          user_id,
          municipality_id,
          started_at
        `,
      )
      .not('municipality_id', 'is', null)
      .order('started_at', { ascending: false })
      .limit(5000),
  ]);

  if (error) throw error;
  if (sessionsResponse.error) throw sessionsResponse.error;

  const rawUsers = (data ?? []) as RawAdminUser[];

  const rawSessions = (sessionsResponse.data ?? []) as Array<{
    user_id?: string | null;
    municipality_id?: string | null;
    started_at?: string | null;
  }>;

  const municipalityIds = Array.from(
    new Set(
      [
        ...rawUsers.map(
          (user) => user.municipality_id ?? user.default_municipality_id ?? null,
        ),
        ...rawSessions.map((session) => session.municipality_id ?? null),
      ].filter(Boolean) as string[],
    ),
  );

  let cityById: Record<string, AdminUser['municipality']> = {};

  if (municipalityIds.length > 0) {
    const { data: citiesResponse, error: citiesError } = await supabase
      .from('municipalities')
      .select('id, name, uf')
      .in('id', municipalityIds);

    if (citiesError) throw citiesError;

    cityById = (citiesResponse ?? []).reduce<
      Record<string, AdminUser['municipality']>
    >((acc, city: any) => {
      if (!city?.id) return acc;

      acc[String(city.id)] = {
        id: String(city.id),
        name: String(city.name ?? ''),
        uf: String(city.uf ?? ''),
      };

      return acc;
    }, {});
  }

  const latestCityByUser = rawSessions.reduce<
    Record<string, AdminUser['municipality']>
  >((acc, session) => {
    if (!session?.user_id || acc[session.user_id]) return acc;

    acc[session.user_id] = session.municipality_id
      ? cityById[session.municipality_id] ?? null
      : null;

    return acc;
  }, {});

  const users = rawUsers.map((user) => {
    const profileCityId = user.municipality_id ?? user.default_municipality_id ?? null;
    const profileCity = profileCityId ? cityById[profileCityId] ?? null : null;
    const latestCity = latestCityByUser[user.id] ?? null;
    const municipality = profileCity ?? latestCity;

    return {
      id: user.id,
      full_name: user.full_name ?? null,
      name: user.name ?? null,
      email: user.email ?? null,
      avatar_url: user.avatar_url ?? null,
      created_at: user.created_at ?? null,
      is_admin: user.is_admin ?? false,
      is_active: isActiveAdminUser(user),
      subscription_status: isActiveAdminUser(user) ? 'active' : 'inactive',
      subscription_due_at: user.subscription_due_at ?? null,
      municipality_id: profileCityId ?? municipality?.id ?? null,
      municipality,
    } as AdminUser;
  });

  return users.filter(
    (user) =>
      (!params?.cityId || user.municipality?.id === params.cityId) &&
      matchesStatusFilter(user, statusFilter) &&
      matchesUserSearch(user, params?.search),
  );
}

export async function getAdminCities(params?: {
  statusFilter?: AdminStatusFilter;
  search?: string;
}) {
  const users = await getAdminUsers({ statusFilter: params?.statusFilter ?? 'all' });

  const grouped = users.reduce<Record<string, AdminCity>>((acc, user) => {
    const city = user.municipality;

    if (!city?.id) return acc;

    if (!acc[city.id]) {
      acc[city.id] = {
        id: city.id,
        name: city.name,
        uf: city.uf,
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
