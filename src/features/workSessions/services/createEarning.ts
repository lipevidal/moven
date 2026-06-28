import { supabase } from '../../../database/supabase';

type CreateEarningParams = {
  session_id?: string | null;
  platform: string;
  amount: number;
  description?: string | null;
  earning_date?: string | Date | null;
};

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
}

function normalizeDate(value?: string | Date | null) {
  if (!value) {
    return toLocalISOString(new Date());
  }

  if (value instanceof Date) {
    return toLocalISOString(value);
  }

  return value;
}

export async function createEarning({
  session_id = null,
  platform,
  amount,
  description,
  earning_date,
}: CreateEarningParams) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user?.id) {
    throw new Error('Usuário não autenticado.');
  }

  if (!platform?.trim()) {
    throw new Error('Informe a plataforma do ganho.');
  }

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error('Informe um valor válido para o ganho.');
  }

  /*
    Quando o ganho pertence a uma jornada, validamos se a jornada é do usuário.
    Isso evita gravar ganho em uma jornada errada e também ajuda quando as regras
    de segurança do Supabase estiverem ativas.
  */
  if (session_id) {
    const { data: session, error: sessionError } = await supabase
      .from('work_sessions')
      .select('id, user_id')
      .eq('id', session_id)
      .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      throw new Error('Jornada não encontrada.');
    }

    if (session.user_id !== user.id) {
      throw new Error('Esta jornada não pertence ao usuário autenticado.');
    }
  }

  const { data, error } = await supabase
    .from('earnings')
    .insert({
      user_id: user.id,
      session_id,
      platform: platform.trim(),
      category: platform.trim(),
      description: description?.trim() || null,
      amount: Number(amount),
      earning_date: normalizeDate(earning_date),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
