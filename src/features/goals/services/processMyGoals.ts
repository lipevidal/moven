import { supabase } from '../../../database/supabase';
import { addXp } from '../../gamification/services/addXp';
import { createNotification } from '../../notifications/services/createNotification';

export async function processMyGoals() {
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

  const now = new Date().toISOString();

  const { data: goals, error: goalsError } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lt('period_end', now);

  if (goalsError) {
    throw goalsError;
  }

  const processed: any[] = [];

  for (const goal of goals ?? []) {
    const { data: earnings, error: earningsError } = await supabase
      .from('earnings')
      .select('amount')
      .eq('user_id', user.id)
      .gte('created_at', goal.period_start)
      .lt('created_at', goal.period_end);

    if (earningsError) {
      throw earningsError;
    }

    const currentAmount = (earnings ?? []).reduce(
      (total, item) => total + Number(item.amount ?? 0),
      0,
    );

    const achieved = currentAmount >= Number(goal.target_amount ?? 0);

    const status = achieved ? 'completed' : 'failed';

    const { error: updateError } = await supabase
      .from('user_goals')
      .update({
        status,
        current_amount: currentAmount,
        completed_at: achieved ? new Date().toISOString() : null,
        evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', goal.id);

    if (updateError) {
      throw updateError;
    }

    if (achieved) {
      await addXp(
        user.id,
        Number(goal.reward_xp ?? 0),
        `Meta ${goal.period_type} alcançada`,
      );

      await createNotification(
        user.id,
        '🎯 Meta alcançada!',
        `Parabéns! Você bateu sua meta e ganhou ${goal.reward_xp} XP.`,
        'goal_completed',
        goal.id,
      );
    } else {
      await createNotification(
        user.id,
        'Meta não batida',
        'Que pena, você não bateu sua meta, mas não desista. Defina uma nova meta e continue evoluindo!',
        'goal_failed',
        goal.id,
      );
    }

    processed.push({
      ...goal,
      current_amount: currentAmount,
      status,
    });
  }

  return processed;
}
