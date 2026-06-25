import { supabase } from '../../../database/supabase';
import { createNotification } from '../../notifications/services/createNotification';
import { addXp } from '../../gamification/services/addXp';
import { evaluateUserBadges } from '../../gamification/services/evaluateUserBadges';


export async function generateTrophies(
  rankings: any[],
  challengeType: string,
  vehicleType: string,
) {
  const trophies = [
    'gold',
    'silver',
    'bronze',
  ];

  const rewards = [
    {
      trophy: 'gold',
      title: '🏆 Recordista de Ouro',
      message: 'Você alcançou o maior faturamento histórico.',
      type: 'recordist_gold',
      xp: 300,
      reason: 'Recordista de Ouro',
    },
    {
      trophy: 'silver',
      title: '🥈 Recordista de Prata',
      message: 'Você entrou para os maiores faturamentos da história.',
      type: 'recordist_silver',
      xp: 200,
      reason: 'Recordista de Prata',
    },
    {
      trophy: 'bronze',
      title: '🥉 Recordista de Bronze',
      message: 'Você está entre os maiores faturamentos já registrados.',
      type: 'recordist_bronze',
      xp: 150,
      reason: 'Recordista de Bronze',
    },
  ];

  for (
    let i = 0;
    i < 3 && i < rankings.length;
    i++
  ) {
    const ranking = rankings[i];
    const reward = rewards[i];

    if (!ranking?.user_id) {
      continue;
    }

    const { error: trophyError } = await supabase
      .from('trophies')
      .insert({
        user_id: ranking.user_id,
        challenge_type: challengeType,
        vehicle_type: vehicleType,
        trophy_type: trophies[i],
      });

    if (trophyError) {
      throw trophyError;
    }

    await addXp(
      ranking.user_id,
      reward.xp,
      reward.reason,
    );

    await createNotification(
      ranking.user_id,
      reward.title,
      reward.message,
      reward.type,
      ranking.id,
    );

    await evaluateUserBadges(ranking.user_id);
  }
}