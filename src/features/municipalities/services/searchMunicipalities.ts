import { supabase } from '../../../database/supabase';

/**
 * Tipo que representa uma cidade/município vindo da tabela municipalities.
 *
 * Campos:
 * - id: identificador único do município no banco.
 * - name: nome da cidade.
 * - uf: sigla do estado, exemplo: MG, SP, RJ.
 * - state_name: nome completo do estado, quando existir no banco.
 * - immediate_region: região imediata do município, quando existir no banco.
 */
export type Municipality = {
  id: string;
  name: string;
  uf: string;
  state_name?: string | null;
  immediate_region?: string | null;
};

/**
 * Busca municípios no Supabase pelo nome da cidade.
 *
 * Essa função é usada na tela de cadastro para o usuário selecionar
 * sua cidade base de atuação.
 *
 * Fluxo:
 * 1. Remove espaços extras do começo e fim da busca.
 * 2. Se tiver menos de 2 letras, não consulta o banco.
 * 3. Busca na tabela municipalities usando ilike.
 * 4. Ordena os resultados pelo nome da cidade.
 * 5. Limita o retorno em 30 cidades para deixar a busca mais leve.
 * 6. Em caso de erro, retorna lista vazia.
 */
export async function searchMunicipalities(search: string) {
  /**
   * Remove espaços extras digitados pelo usuário.
   *
   * Exemplo:
   * "  Belo Horizonte  " vira "Belo Horizonte".
   */
  const term = search.trim();

  /**
   * Evita consultar o Supabase com buscas muito pequenas.
   *
   * Isso melhora performance e evita retornar muitas cidades sem necessidade.
   */
  if (term.length < 2) return [];

  /**
   * Consulta a tabela municipalities.
   *
   * ilike faz uma busca sem diferenciar maiúsculas/minúsculas.
   *
   * Exemplo:
   * - "belo"
   * - "Belo"
   * - "BELO"
   *
   * Todos podem encontrar "Belo Horizonte".
   */
  const { data, error } = await supabase
    .from('municipalities')
    .select('id, name, uf, state_name, immediate_region')
    .ilike('name', `%${term}%`)
    .order('name', { ascending: true })
    .limit(30);

  /**
   * Se der erro na consulta, mostramos no console para debug
   * e retornamos lista vazia para não quebrar a tela de cadastro.
   */
  if (error) {
    console.log('Erro ao buscar cidades:', error);
    return [];
  }

  /**
   * Log útil durante o desenvolvimento.
   *
   * Se quiser deixar a busca mais leve em produção, pode remover este console.log.
   */
  console.log('Cidades encontradas:', data);

  /**
   * Retorna os municípios encontrados.
   *
   * Se data vier null ou undefined, retorna array vazio.
   */
  return data ?? [];
}
