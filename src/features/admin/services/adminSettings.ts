import { supabase } from '../../../database/supabase';
import { requireCurrentUserAdmin } from './adminAccess';

export type SystemSettings = {
  id: string;
  monthly_price: number;
  grace_period_days: number;
  support_whatsapp: string;
  updated_at?: string | null;
};

const SETTINGS_ID = 'default';

export async function getSystemSettings() {
  await requireCurrentUserAdmin();

  const { data, error } = await supabase
    .from('system_settings')
    .select('id, monthly_price, grace_period_days, support_whatsapp, updated_at')
    .eq('id', SETTINGS_ID)
    .maybeSingle();

  if (error) throw error;

  return data as SystemSettings | null;
}

export async function saveSystemSettings(params: {
  monthly_price: number;
  grace_period_days: number;
  support_whatsapp: string;
}) {
  await requireCurrentUserAdmin();

  const { data, error } = await supabase
    .from('system_settings')
    .upsert(
      {
        id: SETTINGS_ID,
        monthly_price: params.monthly_price,
        grace_period_days: params.grace_period_days,
        support_whatsapp: params.support_whatsapp,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('id, monthly_price, grace_period_days, support_whatsapp, updated_at')
    .single();

  if (error) throw error;

  return data as SystemSettings;
}
