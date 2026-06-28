import { supabase } from '../../../database/supabase';

type UpdateEarningParams = {
  earning_id: string;
  platform?: string;
  amount?: number;
  description?: string | null;
  earning_date?: string | Date | null;
};

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
}

function normalizeDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return toLocalISOString(value);
  }

  return value;
}

async function validateEarningOwner({
  earningId,
  userId,
}: {
  earningId: string;
  userId: string;
}) {
  const { data: earning, error: earningError } = await supabase
    .from('earnings')
    .select('id, user_id, session_id')
    .eq('id', earningId)
    .maybeSingle();

  if (earningError) {
    throw earningError;
  }

  if (!earning) {
    throw new Error('Ganho não encontrado.');
  }

  /*
    Alguns ganhos antigos podem ter sido criados sem user_id.
    Se tiver user_id, validamos direto.
    Se não tiver, validamos pelo session_id da jornada.
  */
  if (earning.user_id) {
    if (earning.user_id !== userId) {
      throw new Error('Este ganho não pertence ao usuário autenticado.');
    }

    return earning;
  }

  if (!earning.session_id) {
    throw new Error(
      'Este ganho antigo está sem usuário e sem jornada vinculada. Corrija o registro no banco.',
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from('work_sessions')
    .select('id, user_id')
    .eq('id', earning.session_id)
    .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  if (!session || session.user_id !== userId) {
    throw new Error('Este ganho não pertence ao usuário autenticado.');
  }

  return earning;
}

export async function updateEarning({
  earning_id,
  platform,
  amount,
  description,
  earning_date,
}: UpdateEarningParams) {
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

  const currentEarning = await validateEarningOwner({
    earningId: earning_id,
    userId: user.id,
  });

  const updateData: Record<string, any> = {};

  /*
    Garante que ganhos antigos, criados sem user_id, sejam corrigidos
    na primeira edição.
  */
  if (!currentEarning.user_id) {
    updateData.user_id = user.id;
  }

  if (platform !== undefined) {
    if (!platform.trim()) {
      throw new Error('Informe a plataforma do ganho.');
    }

    updateData.platform = platform.trim();
    updateData.category = platform.trim();
  }

  if (amount !== undefined) {
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new Error('Informe um valor válido para o ganho.');
    }

    updateData.amount = Number(amount);
  }

  if (description !== undefined) {
    updateData.description = description?.trim() || null;
  }

  if (earning_date !== undefined) {
    updateData.earning_date = normalizeDate(earning_date);
  }

  if (Object.keys(updateData).length === 0) {
    const { data, error } = await supabase
      .from('earnings')
      .select()
      .eq('id', earning_id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from('earnings')
    .update(updateData)
    .eq('id', earning_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
