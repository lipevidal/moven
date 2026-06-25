import { supabase } from '../../../database/supabase';

type RegisterChallengePayload = {
  challenge_id?: string | null;
  vehicle_type: 'moto' | 'carro';
  region: string;
  platforms: string[];
  ranking_types: string[];
  selected_days: string[];
  selected_weeks: string[];
  selected_months: string[];
};

type EntryToInsert = {
  challenge_id?: string | null;
  user_id: string;
  vehicle_type: 'moto' | 'carro';
  region: string;
  platforms: string[];
  ranking_type: string;
  ranking_types: string[];
  challenge_type: string;
  selected_days: string[];
  selected_weeks: string[];
  selected_months: string[];
  status: string;
};

async function alreadyRegistered(
  userId: string,
  challengeType: string,
  column: 'selected_days' | 'selected_weeks' | 'selected_months',
  value: string,
) {
  const { data, error } = await supabase
    .from('challenge_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('challenge_type', challengeType)
    .contains(column, [value])
    .limit(1);

  if (error) {
    throw error;
  }

  return Boolean(data && data.length > 0);
}

export async function registerChallenge(
  payload: RegisterChallengePayload,
) {
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

  const entries: EntryToInsert[] = [];

  for (const day of payload.selected_days) {
    const exists = await alreadyRegistered(
      user.id,
      'day',
      'selected_days',
      day,
    );

    if (exists) {
      throw new Error(
        `Você já está inscrito no desafio diário de ${day}.`,
      );
    }

    entries.push({
      challenge_id: payload.challenge_id ?? null,
      user_id: user.id,
      vehicle_type: payload.vehicle_type,
      region: payload.region,
      platforms: payload.platforms,
      ranking_type: 'day',
      ranking_types: ['day'],
      challenge_type: 'day',
      selected_days: [day],
      selected_weeks: [],
      selected_months: [],
      status: 'ongoing',
    });
  }

  for (const week of payload.selected_weeks) {
    const exists = await alreadyRegistered(
      user.id,
      'week',
      'selected_weeks',
      week,
    );

    if (exists) {
      throw new Error(
        `Você já está inscrito no desafio semanal de ${week}.`,
      );
    }

    entries.push({
      challenge_id: payload.challenge_id ?? null,
      user_id: user.id,
      vehicle_type: payload.vehicle_type,
      region: payload.region,
      platforms: payload.platforms,
      ranking_type: 'week',
      ranking_types: ['week'],
      challenge_type: 'week',
      selected_days: [],
      selected_weeks: [week],
      selected_months: [],
      status: 'ongoing',
    });
  }

  for (const month of payload.selected_months) {
    const exists = await alreadyRegistered(
      user.id,
      'month',
      'selected_months',
      month,
    );

    if (exists) {
      throw new Error(
        `Você já está inscrito no desafio mensal de ${month}.`,
      );
    }

    entries.push({
      challenge_id: payload.challenge_id ?? null,
      user_id: user.id,
      vehicle_type: payload.vehicle_type,
      region: payload.region,
      platforms: payload.platforms,
      ranking_type: 'month',
      ranking_types: ['month'],
      challenge_type: 'month',
      selected_days: [],
      selected_weeks: [],
      selected_months: [month],
      status: 'ongoing',
    });
  }

  if (!entries.length) {
    throw new Error('Selecione pelo menos um período de desafio.');
  }

  const { data, error } = await supabase
    .from('challenge_entries')
    .insert(entries)
    .select('*');

  if (error) {
    throw error;
  }

  return data ?? [];
}
