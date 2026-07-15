import { supabase } from '../../../database/supabase';

/**
 * Exclui uma corrida da tabela rides.
 *
 * Essa função recebe o id da corrida e remove o registro do banco.
 *
 * Normalmente é usada quando o usuário exclui:
 * - uma corrida em andamento;
 * - uma corrida aguardando início;
 * - uma corrida lançada incorretamente.
 */
export async function deleteRide(rideId: string) {
  /**
   * Executa o delete na tabela rides.
   *
   * O filtro .eq('id', rideId) garante que somente a corrida
   * com o id informado será excluída.
   */
  const { error } = await supabase
    .from('rides')
    .delete()
    .eq('id', rideId);

  /**
   * Se o Supabase retornar erro, repassa o erro para quem chamou esta função.
   *
   * Assim, a tela pode tratar com try/catch e exibir uma mensagem adequada
   * ao usuário.
   */
  if (error) {
    throw error;
  }

  /**
   * Retorna true indicando que a exclusão foi concluída com sucesso.
   */
  return true;
}
