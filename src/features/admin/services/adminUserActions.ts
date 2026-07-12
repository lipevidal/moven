import { supabase } from '../../../database/supabase';

export type AdminDiscountType = 'amount' | 'percentage';

function parseBrazilianDecimal(value: string) {
  const normalized = String(value ?? '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');

  const number = Number(normalized);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error('Informe um valor válido.');
  }

  return number;
}

function parseBrazilianDate(value: string) {
  const numbers = String(value ?? '').replace(/\D/g, '');

  if (numbers.length !== 8) {
    throw new Error('Informe a data no formato DD/MM/AAAA.');
  }

  const day = Number(numbers.slice(0, 2));
  const month = Number(numbers.slice(2, 4));
  const year = Number(numbers.slice(4, 8));

  const date = new Date(year, month - 1, day);

  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValid) {
    throw new Error('Data inválida.');
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function callAdminRpc<T = boolean>(
  functionName: string,
  params: Record<string, unknown>,
) {
  const { data, error } = await (supabase as any).rpc(functionName, params);

  if (error) {
    throw error;
  }

  return data as T;
}

export async function updateUserSubscriptionDueDate({
  userId,
  dueDate,
}: {
  userId: string;
  dueDate: string;
}) {
  return callAdminRpc('admin_update_user_subscription_due_date', {
    target_user_id: userId,
    p_due_date: parseBrazilianDate(dueDate),
  });
}

export async function setUserAdminStatus({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  return callAdminRpc('admin_set_user_admin_status', {
    target_user_id: userId,
    p_is_admin: isAdmin,
  });
}

export async function setUserFreePlan({
  userId,
  isFree,
}: {
  userId: string;
  isFree: boolean;
}) {
  return callAdminRpc('admin_set_user_free_plan', {
    target_user_id: userId,
    p_is_free: isFree,
  });
}

export async function applyUserDiscountRule({
  userId,
  discountType,
  discountValue,
}: {
  userId: string;
  discountType: AdminDiscountType;
  discountValue: string;
}) {
  const parsedValue = parseBrazilianDecimal(discountValue);

  if (discountType === 'percentage' && parsedValue > 100) {
    throw new Error('O desconto em porcentagem não pode ser maior que 100%.');
  }

  return callAdminRpc('admin_apply_user_discount_rule', {
    target_user_id: userId,
    p_discount_type: discountType,
    p_discount_value: parsedValue,
  });
}

export async function removeUserDiscountRule({ userId }: { userId: string }) {
  return callAdminRpc('admin_remove_user_discount_rule', {
    target_user_id: userId,
  });
}
