import { supabase } from '../../../database/supabase';
import { createNotification } from '../../notifications/services/createNotification';
import { addXp } from '../../gamification/services/addXp';
import { evaluateUserBadges } from '../../gamification/services/evaluateUserBadges';

type GenerateRecordistRankingParams = {
  challengeType: 'day' | 'week' | 'month';
  vehicleType: 'carro' | 'moto';
  scope: 'regional' | 'nacional';
  region?: string;
};

const rewards = [
  {
    trophy: 'gold',
    xp: 300,
    title: '🏆 Recordista de Ouro',
    message: 'Você alcançou um dos maiores faturamentos históricos.',
    type: 'recordist_gold',
  },
  {
    trophy: 'silver',
    xp: 200,
    title: '🥈 Recordista de Prata',
    message: 'Você entrou para os maiores faturamentos da história.',
    type: 'recordist_silver',
  },
  {
    trophy: 'bronze',
    xp: 150,
    title: '🥉 Recordista de Bronze',
    message: 'Você está entre os maiores faturamentos já registrados.',
    type: 'recordist_bronze',
  },
] as const;

export async function generateRecordistRanking({
  challengeType,
  vehicleType,
  scope,
  region,
}: GenerateRecordistRankingParams) {
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
      created_at
      `,
    )
    .eq('status', 'completed')
    .eq('challenge_type', challengeType)
    .eq('vehicle_type', vehicleType)
    .gt('approved_amount', 0);

  if (scope === 'regional') {
    if (!region) {
      throw new Error('Informe a região para gerar recordistas regionais.');
    }

    query = query.eq('region', region);
  }

  const { data: entries, error } = await query
    .order('approved_amount', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(3);

  if (error) {
    throw error;
  }

  const ranking = entries ?? [];

  for (let index = 0; index < ranking.length; index++) {
    const entry = ranking[index];
    const reward = rewards[index];

    if (!reward) {
      continue;
    }

    const { data: existingTrophies, error: existingError } =
      await supabase
        .from('trophies')
        .select('id')
        .eq('user_id', entry.user_id)
        .eq('challenge_type', challengeType)
        .eq('vehicle_type', vehicleType)
        .eq('trophy_type', reward.trophy)
        .eq('scope', scope)
        .eq('region', scope === 'regional' ? region : null)
        .limit(1);

    if (existingError) {
      throw existingError;
    }

    const alreadyHasTrophy =
      existingTrophies && existingTrophies.length > 0;

    if (alreadyHasTrophy) {
      continue;
    }

    const { error: trophyError } = await supabase
      .from('trophies')
      .insert({
        user_id: entry.user_id,
        challenge_type: challengeType,
        vehicle_type: vehicleType,
        trophy_type: reward.trophy,
        scope,
        region: scope === 'regional' ? region : null,
      });

    if (trophyError) {
      throw trophyError;
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

  return ranking.map((entry, index) => ({
    ...entry,
    record_position: index + 1,
    trophy: rewards[index]?.trophy ?? null,
  }));
}
