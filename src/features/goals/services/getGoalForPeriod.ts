import { supabase } from '../../../database/supabase';

/**
 * Tipos de período aceitos pelo sistema de metas.
 *
 * day:
 * - meta diária.
 *
 * week:
 * - meta semanal.
 *
 * month:
 * - meta mensal.
 *
 * year:
 * - meta anual.
 */
export type GoalPeriodType = 'day' | 'week' | 'month' | 'year';

/**
 * Busca a meta do usuário logado para um período específico.
 *
 * Essa função é usada para verificar se já existe uma meta cadastrada
 * para o período selecionado no Dashboard.
 *
 * Parâmetros:
 * - periodType: tipo do período da meta, como dia, semana, mês ou ano.
 * - periodKey: chave única do período.
 *
 * Exemplos de periodKey:
 * - dia: 2026-07-13
 * - mês: 2026-07
 * - ano: 2026
 */
export async function getGoalForPeriod(
  periodType: GoalPeriodType,
  periodKey: string,
) {
  /**
   * Busca o usuário autenticado no Supabase Auth.
   *
   * O user.id será usado para filtrar as metas apenas do usuário logado.
   */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  /**
   * Se houver erro ao buscar o usuário, repassa o erro para quem chamou
   * esta função.
   *
   * Assim, a tela pode tratar com try/catch e exibir uma mensagem adequada.
   */
  if (userError) {
    throw userError;
  }

  /**
   * Se não houver usuário logado, retorna null.
   *
   * Isso indica que não existe meta disponível para carregar.
   */
  if (!user) {
    return null;
  }

  /**
   * Busca na tabela user_goals a meta do usuário para o período informado.
   *
   * Filtros:
   * - user_id: usuário logado;
   * - period_type: dia, semana, mês ou ano;
   * - period_key: chave única do período.
   *
   * maybeSingle():
   * - retorna um único registro se existir;
   * - retorna null se não existir;
   * - evita erro quando o usuário ainda não criou meta para esse período.
   */
  const { data, error } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('period_type', periodType)
    .eq('period_key', periodKey)
    .maybeSingle();

  /**
   * Se houver erro na consulta, repassa o erro para quem chamou a função.
   */
  if (error) {
    throw error;
  }

  /**
   * Retorna a meta encontrada.
   *
   * Se não existir meta para o período, retorna null.
   */
  return data;
}
