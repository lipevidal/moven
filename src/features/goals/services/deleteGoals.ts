import { supabase } from '../../../database/supabase';

/**
 * Exclui uma ou várias metas da tabela user_goals.
 *
 * Essa função recebe uma lista de ids de metas e remove todos os registros
 * correspondentes no banco de dados.
 *
 * Normalmente é usada no modal de exclusão de metas, onde o usuário pode
 * selecionar uma ou mais metas para apagar de uma vez.
 */
export async function deleteGoals(goalIds: string[]) {
  /**
   * Se a lista de ids estiver vazia, não há nada para excluir.
   *
   * Retornamos true para indicar que a função terminou sem erro,
   * evitando fazer uma chamada desnecessária ao Supabase.
   */
  if (goalIds.length === 0) {
    return true;
  }

  /**
   * Exclui da tabela user_goals todas as metas cujo id esteja dentro
   * da lista goalIds.
   *
   * O filtro .in('id', goalIds) funciona como:
   * - delete where id in (...)
   *
   * Assim, permite remover várias metas em uma única chamada ao banco.
   */
  const { error } = await supabase
    .from('user_goals')
    .delete()
    .in('id', goalIds);

  /**
   * Se o Supabase retornar erro, repassa o erro para quem chamou a função.
   *
   * Assim, a tela consegue tratar com try/catch e mostrar uma mensagem
   * adequada ao usuário.
   */
  if (error) {
    throw error;
  }

  /**
   * Retorna true indicando que a exclusão foi concluída com sucesso.
   */
  return true;
}
