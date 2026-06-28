import { supabase } from '../../../database/supabase';

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

  if (earning.user_id) {
    if (earning.user_id !== userId) {
      throw new Error('Este ganho não pertence ao usuário autenticado.');
    }

    return;
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
}

export async function deleteEarning(earning_id: string) {
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

  await validateEarningOwner({
    earningId: earning_id,
    userId: user.id,
  });

  const { error } = await supabase
    .from('earnings')
    .delete()
    .eq('id', earning_id);

  if (error) {
    throw error;
  }

  return true;
}
