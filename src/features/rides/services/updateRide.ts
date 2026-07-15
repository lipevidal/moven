import { supabase } from '../../../database/supabase';

/**
 * Parâmetros necessários para editar uma corrida.
 *
 * ride_id:
 * - id da corrida que será atualizada.
 *
 * platform:
 * - nome da plataforma da corrida, exemplo: Uber, 99, iFood.
 *
 * amount:
 * - valor da corrida.
 *
 * start_km:
 * - KM inicial da corrida.
 * - pode ser number, null ou undefined.
 * - quando undefined, o campo é enviado assim mesmo no update atual.
 */
type UpdateRideParams = {
  ride_id: string;
  platform: string;
  amount: number;
  start_km?: number | null;
};

/**
 * Atualiza os dados principais de uma corrida na tabela rides.
 *
 * Essa função normalmente é usada para editar:
 * - plataforma;
 * - valor;
 * - KM inicial.
 *
 * Ela pode ser usada tanto em corrida aguardando quanto em corrida ativa,
 * dependendo de onde for chamada na interface.
 */
export async function updateRide({
  ride_id,
  platform,
  amount,
  start_km,
}: UpdateRideParams) {
  /**
   * Atualiza a corrida no Supabase.
   *
   * O filtro .eq('id', ride_id) garante que somente a corrida escolhida
   * será alterada.
   *
   * .select().single():
   * - retorna a corrida atualizada;
   * - espera apenas um registro como resposta.
   */
  const { data, error } = await supabase
    .from('rides')
    .update({
      platform,
      amount,
      start_km,
    })
    .eq('id', ride_id)
    .select()
    .single();

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
   * Retorna a corrida atualizada.
   */
  return data;
}
