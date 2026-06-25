import { supabase } from '../../../database/supabase';

export async function deleteGoals(goalIds: string[]) {
  if (goalIds.length === 0) {
    return true;
  }

  const { error } = await supabase
    .from('user_goals')
    .delete()
    .in('id', goalIds);

  if (error) {
    throw error;
  }

  return true;
}
