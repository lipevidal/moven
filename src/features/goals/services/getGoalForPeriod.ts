import { supabase } from '../../../database/supabase';

export type GoalPeriodType = 'day' | 'week' | 'month' | 'year';

export async function getGoalForPeriod(
  periodType: GoalPeriodType,
  periodKey: string,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('period_type', periodType)
    .eq('period_key', periodKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
