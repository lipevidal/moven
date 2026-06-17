import { supabase } from '../../../database/supabase';

export async function shareResult(params: {
  type: 'session' | 'day' | 'week' | 'month' | 'year';
  reference_id: string;
  title: string;
  period_label: string;
  revenue: number;
  expenses: number;
  profit: number;
  worked_seconds: number;
  km_driven: number;
  gain_per_hour: number;
  gain_per_km: number;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuário não encontrado.');

  const { error } = await supabase.from('shared_results').insert({
    ...params,
    user_id: user.id,
  });

  if (error) throw error;
}