import { supabase } from '../../../database/supabase';

/**
 * Parâmetros necessários para iniciar uma corrida que estava aguardando.
 *
 * ride_id:
 * - id da corrida que está com status "waiting".
 *
 * start_km:
 * - KM inicial da corrida no momento em que ela começa.
 */
type StartWaitingRideParams = {
  ride_id: string;
  start_km: number;
};

/**
 * Converte uma data local para ISO sem deslocar o horário por causa do timezone.
 *
 * Esse ajuste ajuda a salvar no banco o horário local correto do aparelho,
 * evitando diferença causada pelo fuso horário.
 */
function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, -1);
}

/**
 * Inicia uma corrida que estava aguardando início.
 *
 * Essa função muda a corrida de:
 *
 * status: "waiting"
 *
 * para:
 *
 * status: "active"
 *
 * Além disso, salva:
 * - start_km: KM inicial informado;
 * - started_at: data/hora atual do início da corrida.
 */
export async function startWaitingRide({
  ride_id,
  start_km,
}: StartWaitingRideParams) {
  /**
   * Atualiza a corrida na tabela rides.
   *
   * A chamada usa:
   * - .eq('id', ride_id) para alterar somente a corrida escolhida;
   * - .select().single() para retornar a corrida atualizada.
   */
  const { data, error } = await supabase
    .from('rides')
    .update({
      status: 'active',
      start_km,
      started_at: toLocalISOString(new Date()),
    })
    .eq('id', ride_id)
    .select()
    .single();

  /**
   * Se o Supabase retornar erro, repassa o erro para quem chamou esta função.
   *
   * Assim, a tela pode tratar com try/catch e mostrar uma mensagem ao usuário.
   */
  if (error) {
    throw error;
  }

  /**
   * Retorna a corrida atualizada.
   */
  return data;
}
