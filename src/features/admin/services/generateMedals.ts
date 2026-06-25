import { supabase } from '../../../database/supabase';
import { createNotification } from '../../notifications/services/createNotification';
import { addXp } from '../../gamification/services/addXp';
import { evaluateUserBadges } from '../../gamification/services/evaluateUserBadges';

export async function generateMedals(
  challengeEntries: any[],
) {
  const medals = [
    'gold',
    'silver',
    'bronze',
  ];

  const rewards = [
    {
      medal: 'gold',
      title: '🥇 Medalha de Ouro',
      message: 'Parabéns! Você conquistou o 1º lugar.',
      type: 'gold_medal',
      xp: 100,
      reason: 'Medalha de Ouro',
    },
    {
      medal: 'silver',
      title: '🥈 Medalha de Prata',
      message: 'Parabéns! Você conquistou o 2º lugar.',
      type: 'silver_medal',
      xp: 75,
      reason: 'Medalha de Prata',
    },
    {
      medal: 'bronze',
      title: '🥉 Medalha de Bronze',
      message: 'Parabéns! Você conquistou o 3º lugar.',
      type: 'bronze_medal',
      xp: 50,
      reason: 'Medalha de Bronze',
    },
  ];

  for (
    let i = 0;
    i < 3 && i < challengeEntries.length;
    i++
  ) {
    const entry = challengeEntries[i];
    const reward = rewards[i];

    const { error: medalError } = await supabase
      .from('medals')
      .insert({
        user_id: entry.user_id,
        challenge_id: entry.id,
        medal_type: medals[i],
      });

    if (medalError) {
      throw medalError;
    }

    await supabase
      .from('challenge_entries')
      .update({
        medal: reward.medal,
        position: i + 1,
      })
      .eq('id', entry.id);

    await addXp(
      entry.user_id,
      reward.xp,
      reward.reason,
    );

    await createNotification(
      entry.user_id,
      reward.title,
      reward.message,
      reward.type,
      entry.id,
    );

    await evaluateUserBadges(entry.user_id);
  }
}

