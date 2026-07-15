import { supabase } from '../../../database/supabase';

/**
 * Busca a quantidade de notificações não lidas do usuário logado.
 *
 * Essa função é usada, por exemplo, no componente NotificationBell
 * para exibir o número de notificações pendentes no badge vermelho.
 */
export async function getUnreadNotificationsCount() {
  /**
   * Busca o usuário autenticado no Supabase Auth.
   *
   * Também capturamos userError porque uma falha na autenticação deve ser
   * repassada para quem chamou esta função.
   */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  /**
   * Se houver erro ao buscar o usuário, interrompe a função.
   *
   * Assim, o componente ou tela que chamou esse service pode tratar o erro
   * com try/catch.
   */
  if (userError) {
    throw userError;
  }

  /**
   * Se não houver usuário logado, retorna 0.
   *
   * Isso evita consultar notificações sem um user_id válido.
   */
  if (!user) {
    return 0;
  }

  /**
   * Conta as notificações não lidas do usuário.
   *
   * select('id', { count: 'exact', head: true }):
   * - count: 'exact' pede ao Supabase a contagem exata dos registros;
   * - head: true faz a consulta retornar apenas a contagem, sem trazer os dados.
   *
   * Isso deixa a consulta mais leve, porque não carrega a lista de notificações,
   * apenas o total.
   *
   * Filtros:
   * - user_id = usuário logado;
   * - read = false, ou seja, notificações ainda não lidas.
   */
  const { count, error } = await supabase
    .from('notifications')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', user.id)
    .eq('read', false);

  /**
   * Se houver erro na consulta, repassa o erro para quem chamou a função.
   */
  if (error) {
    throw error;
  }

  /**
   * Retorna a quantidade encontrada.
   *
   * Se count vier null, retorna 0 para manter um número seguro.
   */
  return count ?? 0;
}
