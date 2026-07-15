import { supabase } from '../../../database/supabase';
import { GoalPeriodType } from './getGoalForPeriod';

/**
 * Dados necessários para criar ou atualizar uma meta.
 *
 * periodType:
 * - tipo da meta: dia, semana, mês ou ano.
 *
 * periodKey:
 * - chave única do período.
 * - exemplo: 2026-07-13, 2026-07 ou 2026.
 *
 * periodStart:
 * - data inicial do período da meta.
 *
 * periodEnd:
 * - data final do período da meta.
 *
 * targetAmount:
 * - valor definido como meta.
 */
type SaveGoalPayload = {
  periodType: GoalPeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  targetAmount: number;
};

/**
 * Cria ou atualiza uma meta do usuário logado.
 *
 * Essa função usa upsert, ou seja:
 * - se ainda não existir meta para o mesmo usuário, tipo e período, cria uma nova;
 * - se já existir, atualiza a meta existente.
 */
export async function saveGoal({
  periodType,
  periodKey,
  periodStart,
  periodEnd,
  targetAmount,
}: SaveGoalPayload) {
  /**
   * Busca o usuário autenticado no Supabase Auth.
   *
   * O user.id será usado para salvar a meta vinculada ao usuário correto.
   */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  /**
   * Se houver erro ao buscar o usuário, interrompe a função.
   *
   * Assim, a tela consegue tratar o erro com try/catch.
   */
  if (userError) {
    throw userError;
  }

  /**
   * Se não houver usuário logado, não é possível salvar a meta.
   */
  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  /**
   * Validação básica do valor da meta.
   *
   * A meta precisa ser maior que zero.
   */
  if (targetAmount <= 0) {
    throw new Error('Informe um valor de meta maior que zero.');
  }

  /**
   * Cria ou atualiza a meta na tabela user_goals.
   *
   * Campos principais:
   * - user_id: usuário dono da meta;
   * - period_type: tipo do período;
   * - period_key: chave única do período;
   * - period_start: início do período;
   * - period_end: fim do período;
   * - target_amount: valor da meta;
   * - status: começa como active;
   * - completed_at: fica null até a meta ser concluída;
   * - evaluated_at: fica null até a meta ser avaliada;
   * - updated_at: registra a data/hora da última atualização.
   *
   * onConflict:
   * - impede metas duplicadas para o mesmo usuário, tipo e período;
   * - se já existir, atualiza o registro existente.
   */
  const { data, error } = await supabase
    .from('user_goals')
    .upsert(
      {
        user_id: user.id,
        period_type: periodType,
        period_key: periodKey,
        period_start: periodStart,
        period_end: periodEnd,
        target_amount: targetAmount,
        status: 'active',
        completed_at: null,
        evaluated_at: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,period_type,period_key',
      },
    )
    .select('*')
    .single();

  /**
   * Se o Supabase retornar erro, repassa para quem chamou esta função.
   */
  if (error) {
    throw error;
  }

  /**
   * Retorna a meta criada ou atualizada.
   */
  return data;
}
