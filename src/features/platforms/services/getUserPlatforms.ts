import { supabase } from '../../../database/supabase';

/**
 * Busca as plataformas ativas selecionadas pelo usuário logado.
 *
 * Essa função normalmente é usada em telas onde o app precisa mostrar
 * somente as plataformas que o próprio usuário escolheu usar.
 *
 * Exemplos de uso:
 * - modal de ganho avulso;
 * - modal de corrida;
 * - filtros por plataforma;
 * - gerenciamento de plataformas do usuário.
 */
export async function getUserPlatforms() {
  /**
   * Busca o usuário autenticado no Supabase Auth.
   *
   * O user.id será usado para filtrar a tabela user_platforms
   * e retornar apenas as plataformas do usuário atual.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * Se não houver usuário logado, retorna array vazio.
   *
   * Isso evita erro em telas que usam .map(), .filter() ou .length.
   */
  if (!user) return [];

  /**
   * Consulta a tabela user_platforms.
   *
   * Campos buscados:
   * - id: id do vínculo entre usuário e plataforma;
   * - platform_id: id da plataforma;
   * - is_active: indica se o vínculo está ativo;
   * - platform:platforms(*): busca junto os dados completos da plataforma
   *   relacionada, usando relacionamento com a tabela platforms.
   *
   * Filtros:
   * - user_id = usuário logado;
   * - is_active = true, para retornar apenas plataformas ativas do usuário.
   */
  const { data, error } = await supabase
    .from('user_platforms')
    .select(`
      id,
      platform_id,
      is_active,
      platform:platforms(*)
    `)
    .eq('user_id', user.id)
    .eq('is_active', true);

  /**
   * Se houver erro, lança o erro para a tela ou função que chamou este service.
   *
   * Assim, quem chamou getUserPlatforms pode tratar com try/catch
   * e exibir uma mensagem adequada ao usuário.
   */
  if (error) throw error;

  /**
   * Retorna as plataformas encontradas.
   *
   * Se data vier null ou undefined, retorna array vazio.
   */
  return data ?? [];
}
