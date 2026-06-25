import { supabase } from '../../../database/supabase';
import { createNotification } from '../../notifications/services/createNotification';
import { addXp } from '../../gamification/services/addXp';
import { evaluateUserBadges } from '../../gamification/services/evaluateUserBadges';

type GenerateChallengeRankingParams = {
  challengeType: 'day' | 'week' | 'month';
  vehicleType: 'carro' | 'moto';
  scope: 'regional' | 'nacional';
  region?: string;
};

const rewards = [
  {
    medal: 'gold',
    xp: 100,
    title: '🥇 Medalha de Ouro',
    message: 'Você ficou em 1º lugar no desafio.',
    type: 'medal_gold',
  },
  {
    medal: 'silver',
    xp: 75,
    title: '🥈 Medalha de Prata',
    message: 'Você ficou em 2º lugar no desafio.',
    type: 'medal_silver',
  },
  {
    medal: 'bronze',
    xp: 50,
    title: '🥉 Medalha de Bronze',
    message: 'Você ficou em 3º lugar no desafio.',
    type: 'medal_bronze',
  },
] as const;

export async function generateChallengeRanking({
  challengeType,
  vehicleType,
  scope,
  region,
}: GenerateChallengeRankingParams) {
  let query = supabase
    .from('challenge_entries')
    .select(
      `
      id,
      user_id,
      challenge_type,
      vehicle_type,
      region,
      approved_amount,
      position,
      medal,
      status,
      created_at
      `,
    )
    .eq('status', 'completed')
    .eq('challenge_type', challengeType)
    .eq('vehicle_type', vehicleType)
    .gt('approved_amount', 0);

  if (scope === 'regional') {
    if (!region) {
      throw new Error('Informe a região para gerar ranking regional.');
    }

    query = query.eq('region', region);
  }

  const { data: entries, error } = await query
    .order('approved_amount', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const ranking = entries ?? [];

  for (let index = 0; index < ranking.length; index++) {
    const entry = ranking[index];
    const position = index + 1;
    const reward = rewards[index];

    const medal = reward?.medal ?? null;

    const { error: updateError } = await supabase
      .from('challenge_entries')
      .update({
        position,
        medal,
      })
      .eq('id', entry.id);

    if (updateError) {
      throw updateError;
    }

    if (!reward) {
      continue;
    }

    const { data: existingMedals, error: existingMedalsError } =
      await supabase
        .from('medals')
        .select('id')
        .eq('user_id', entry.user_id)
        .eq('challenge_id', entry.id)
        .eq('medal_type', reward.medal)
        .limit(1);

    if (existingMedalsError) {
      throw existingMedalsError;
    }

    const alreadyHasMedal =
      existingMedals && existingMedals.length > 0;

    if (!alreadyHasMedal) {
      const { error: medalError } = await supabase
        .from('medals')
        .insert({
          user_id: entry.user_id,
          challenge_id: entry.id,
          medal_type: reward.medal,
        });

      if (medalError) {
        throw medalError;
      }

      await addXp(
        entry.user_id,
        reward.xp,
        reward.title,
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

  return ranking.map((entry, index) => ({
    ...entry,
    position: index + 1,
    medal: rewards[index]?.medal ?? null,
  }));
}
