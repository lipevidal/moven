import { supabase } from '../../../database/supabase';
import { GoalPeriodType } from './getGoalForPeriod';

const rewardByPeriod: Record<GoalPeriodType, number> = {
  day: 10,
  week: 30,
  month: 50,
  year: 100,
};

type SaveGoalPayload = {
  periodType: GoalPeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  targetAmount: number;
};

export async function saveGoal({
  periodType,
  periodKey,
  periodStart,
  periodEnd,
  targetAmount,
}: SaveGoalPayload) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  if (targetAmount <= 0) {
    throw new Error('Informe um valor de meta maior que zero.');
  }

  const { data, error } = await supabase
    .from('user_goals')
    .upsert(
      {
        user_id: user.id,
        period_type: periodType,
        period_key: periodKey,
        period_start: periodStart,
        period_end: periodEnd,
        target_amount: targetAmount,
        reward_xp: rewardByPeriod[periodType],
        status: 'active',
        completed_at: null,
        evaluated_at: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,period_type,period_key',
      },
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}
