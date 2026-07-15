import { supabase } from '../../../database/supabase';

/**
 * Parâmetros necessários para criar uma corrida.
 *
 * session_id:
 * - id da jornada atual.
 *
 * vehicle_id:
 * - id do veículo usado na jornada.
 *
 * platform:
 * - nome da plataforma, exemplo: Uber, 99, iFood etc.
 *
 * amount:
 * - valor da corrida.
 *
 * start_km:
 * - KM inicial da corrida.
 * - obrigatório apenas quando a corrida já começa ativa.
 *
 * status:
 * - waiting: corrida cadastrada, mas ainda aguardando início.
 * - active: corrida já iniciada.
 */
type CreateRideParams = {
  session_id: string;
  vehicle_id: string;
  platform: string;
  amount: number;
  start_km?: number;
  status: 'waiting' | 'active';
};

/**
 * Converte uma data local para ISO sem deslocar o horário pelo timezone.
 *
 * Esse ajuste evita que uma data/hora local seja salva com diferença
 * causada pelo fuso horário.
 *
 * Exemplo:
 * - usuário está no Brasil;
 * - cria uma corrida agora;
 * - o app salva o horário local corretamente no banco.
 */
function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, -1);
}

/**
 * Cria uma corrida na tabela rides.
 *
 * Essa função é usada quando o usuário registra uma corrida dentro
 * de uma jornada ativa.
 *
 * Existem dois comportamentos:
 *
 * 1. status = 'active'
 *    - a corrida já começa em andamento;
 *    - salva start_km;
 *    - salva started_at com o horário atual.
 *
 * 2. status = 'waiting'
 *    - a corrida fica aguardando início;
 *    - start_km fica null;
 *    - started_at fica null.
 */
export async function createRide({
  session_id,
  vehicle_id,
  platform,
  amount,
  start_km,
  status,
}: CreateRideParams) {
  /**
   * Busca o usuário autenticado no Supabase Auth.
   *
   * O user.id será salvo na corrida para vincular o registro
   * ao usuário correto.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * Se não houver usuário logado, interrompe a criação.
   */
  if (!user) {
    throw new Error('Usuário não autenticado.');
  }

  /**
   * Define se a corrida será criada como ativa.
   *
   * Quando for ativa, precisamos salvar:
   * - start_km
   * - started_at
   *
   * Quando for aguardando, esses campos ficam vazios.
   */
  const isActive = status === 'active';

  /**
   * Insere a corrida no banco.
   *
   * Campos importantes:
   * - user_id: dono da corrida;
   * - session_id: jornada vinculada;
   * - vehicle_id: veículo usado;
   * - platform: plataforma;
   * - amount: valor;
   * - status: active ou waiting;
   * - start_km: KM inicial somente quando ativa;
   * - started_at: horário inicial somente quando ativa.
   */
  const { data, error } = await supabase
    .from('rides')
    .insert({
      user_id: user.id,
      session_id,
      vehicle_id,
      platform,
      amount,
      status,
      start_km: isActive ? start_km : null,
      started_at: isActive ? toLocalISOString(new Date()) : null,
    })
    .select()
    .single();

  /**
   * Se o Supabase retornar erro, repassa o erro para quem chamou esta função.
   *
   * Assim, a tela pode tratar com try/catch e exibir a mensagem adequada.
   */
  if (error) {
    throw error;
  }

  /**
   * Retorna a corrida criada.
   */
  return data;
}
