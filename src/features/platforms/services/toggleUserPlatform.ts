import { supabase } from '../../../database/supabase';

/**
 * Ativa ou desativa uma plataforma para o usuário logado.
 *
 * Essa função é usada quando o usuário marca/desmarca uma plataforma
 * na tela/modal de gerenciamento de plataformas.
 *
 * Parâmetros:
 * - platformId: id da plataforma que será ativada/desativada.
 * - selected: indica se a plataforma deve ficar ativa ou inativa.
 *
 * selected = true:
 * - cria ou atualiza o vínculo do usuário com a plataforma;
 * - define is_active como true.
 *
 * selected = false:
 * - mantém o registro no banco;
 * - apenas muda is_active para false.
 */
export async function toggleUserPlatform(platformId: string, selected: boolean) {
  /**
   * Busca o usuário autenticado no Supabase Auth.
   *
   * O user.id será usado para salvar a plataforma vinculada ao usuário certo.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * Se não houver usuário logado, interrompe a função.
   *
   * Isso evita criar ou alterar plataformas sem saber quem é o dono.
   */
  if (!user) throw new Error('Usuário não autenticado.');

  /**
   * Quando selected é true, a plataforma deve ser ativada para o usuário.
   */
  if (selected) {
    /**
     * upsert cria ou atualiza o vínculo na tabela user_platforms.
     *
     * Se ainda não existir um registro com:
     * - user_id
     * - platform_id
     *
     * então ele cria.
     *
     * Se já existir, ele atualiza o registro existente.
     *
     * onConflict: 'user_id,platform_id'
     * indica que a combinação user_id + platform_id deve ser única.
     */
    const { error } = await supabase
      .from('user_platforms')
      .upsert(
        {
          user_id: user.id,
          platform_id: platformId,
          is_active: true,
        },
        {
          onConflict: 'user_id,platform_id',
        },
      );

    /**
     * Se o Supabase retornar erro, lança o erro para quem chamou esta função.
     *
     * Assim, a tela pode tratar com try/catch e exibir uma mensagem ao usuário.
     */
    if (error) throw error;

    /**
     * Retorna true indicando que a operação foi concluída.
     */
    return true;
  }

  /**
   * Quando selected é false, a plataforma é desativada.
   *
   * Importante:
   * - o registro não é deletado;
   * - apenas fica com is_active = false.
   *
   * Isso preserva histórico e evita recriar dados desnecessariamente.
   */
  const { error } = await supabase
    .from('user_platforms')
    .update({
      is_active: false,
    })
    .eq('user_id', user.id)
    .eq('platform_id', platformId);

  /**
   * Se houver erro ao desativar, repassa o erro para quem chamou a função.
   */
  if (error) throw error;

  /**
   * Retorna true indicando que a plataforma foi desativada com sucesso.
   */
  return true;
}
