import { supabase } from '../../../database/supabase';
import { GoalPeriodType } from './getGoalForPeriod';

export async function getGoalsFromPeriod(
  periodType: GoalPeriodType,
  periodStart: string,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('period_type', periodType)
    .gte('period_start', periodStart)
    .order('period_start', { ascending: true })
    .limit(40);

  if (error) {
    throw error;
  }

  return data ?? [];
}
