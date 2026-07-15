import { supabase } from '../../../database/supabase';

/**
 * Busca todas as plataformas ativas cadastradas no sistema.
 *
 * Essa função normalmente é usada em telas onde o usuário precisa escolher
 * uma plataforma, como:
 *
 * - ganho avulso;
 * - corrida;
 * - gerenciamento de plataformas;
 * - filtros ou seletores relacionados às plataformas.
 */
export async function getPlatforms() {
  /**
   * Consulta a tabela platforms no Supabase.
   *
   * select('*'):
   * - busca todas as colunas da plataforma.
   *
   * eq('is_active', true):
   * - retorna somente plataformas ativas.
   * - plataformas desativadas no banco não aparecem para o usuário.
   *
   * order('name', { ascending: true }):
   * - ordena alfabeticamente pelo nome.
   */
  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  /**
   * Se o Supabase retornar erro, mostramos no console para facilitar o debug
   * e lançamos o erro novamente.
   *
   * Isso permite que a tela que chamou getPlatforms trate o erro com try/catch.
   */
  if (error) {
    console.log('Erro ao buscar platforms:', error);
    throw error;
  }

  /**
   * Retorna as plataformas encontradas.
   *
   * Se data vier null ou undefined, retorna array vazio para evitar erro
   * em telas que usam .map(), .filter() ou .length.
   */
  return data ?? [];
}
