import { supabase } from '../../../database/supabase';
import { GoalPeriodType } from './getGoalForPeriod';

/**
 * Busca várias metas do usuário logado a partir de um período inicial.
 *
 * Essa função é usada principalmente no modal de exclusão de metas,
 * onde o usuário pode visualizar metas futuras e selecionar quais deseja excluir.
 *
 * Parâmetros:
 * - periodType: tipo da meta, como dia, semana, mês ou ano;
 * - periodStart: data inicial usada como ponto de partida da busca.
 */
export async function getGoalsFromPeriod(
  periodType: GoalPeriodType,
  periodStart: string,
) {
  /**
   * Busca o usuário autenticado no Supabase Auth.
   *
   * O user.id será usado para buscar somente as metas do usuário logado.
   */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  /**
   * Se houver erro ao buscar o usuário, interrompe a função.
   *
   * Assim, quem chamou esse service pode tratar o erro com try/catch.
   */
  if (userError) {
    throw userError;
  }

  /**
   * Se não houver usuário logado, retorna uma lista vazia.
   *
   * Isso evita consultar metas sem um user_id válido.
   */
  if (!user) {
    return [];
  }

  /**
   * Busca as metas na tabela user_goals.
   *
   * Filtros:
   * - user_id: apenas metas do usuário logado;
   * - period_type: apenas metas do tipo informado;
   * - period_start >= periodStart: metas a partir do período selecionado.
   *
   * Ordenação:
   * - period_start crescente para mostrar as metas em ordem cronológica.
   *
   * Limite:
   * - 40 registros para evitar carregar uma quantidade muito grande de metas
   *   de uma só vez.
   */
  const { data, error } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('period_type', periodType)
    .gte('period_start', periodStart)
    .order('period_start', { ascending: true })
    .limit(40);

  /**
   * Se o Supabase retornar erro, repassa o erro para quem chamou a função.
   */
  if (error) {
    throw error;
  }

  /**
   * Retorna as metas encontradas.
   *
   * Se data vier null, retorna uma lista vazia para evitar erro na tela.
   */
  return data ?? [];
}
