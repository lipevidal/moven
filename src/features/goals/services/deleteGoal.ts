import { supabase } from '../../../database/supabase';

export async function deleteGoal(goalId: string) {
  const { error } = await supabase
    .from('user_goals')
    .delete()
    .eq('id', goalId);

  if (error) {
    throw error;
  }

  return true;
}
