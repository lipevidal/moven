import { supabase } from '../../../database/supabase';

/**
 * Parâmetros necessários para finalizar uma corrida.
 *
 * ride_id:
 * - id da corrida que será finalizada.
 *
 * session_id:
 * - id da jornada vinculada à corrida.
 *
 * vehicle_id:
 * - id do veículo usado na jornada/corrida.
 *
 * platform:
 * - nome da plataforma da corrida, exemplo: Uber, 99, iFood.
 *
 * amount:
 * - valor recebido pela corrida.
 *
 * start_km:
 * - KM inicial da corrida.
 *
 * end_km:
 * - KM final da corrida.
 *
 * started_at:
 * - data/hora em que a corrida foi iniciada.
 */
type FinishRideParams = {
  ride_id: string;
  session_id: string;
  vehicle_id: string;
  platform: string;
  amount: number;
  start_km: number;
  end_km: number;
  started_at: string;
};

/**
 * Converte uma data local para ISO sem deslocar o horário por causa do timezone.
 *
 * Isso ajuda a salvar no banco a data/hora local do aparelho,
 * evitando diferenças causadas pelo fuso horário.
 */
function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, -1);
}

/**
 * Finaliza uma corrida ativa.
 *
 * Essa função faz várias atualizações importantes no sistema:
 *
 * 1. Finaliza a corrida na tabela rides.
 * 2. Calcula:
 *    - duração;
 *    - KM rodados;
 *    - ganho por hora;
 *    - ganho por KM.
 * 3. Atualiza ou cria um ganho na tabela earnings.
 * 4. Atualiza o KM final da jornada em work_sessions.
 * 5. Atualiza o KM atual do veículo em vehicles.
 * 6. Verifica se existe uma próxima corrida aguardando.
 * 7. Se existir, inicia automaticamente essa próxima corrida.
 */
export async function finishRide({
  ride_id,
  session_id,
  vehicle_id,
  platform,
  amount,
  start_km,
  end_km,
  started_at,
}: FinishRideParams) {
  /**
   * Marca o horário atual como horário de finalização da corrida.
   */
  const finishedAt = new Date();

  /**
   * Converte o started_at recebido do banco para Date.
   */
  const startedAtDate = new Date(started_at);

  /**
   * Calcula a duração da corrida em horas.
   *
   * Exemplo:
   * - 30 minutos vira 0.5 hora.
   * - 1h30 vira 1.5 hora.
   */
  const durationHours =
    (finishedAt.getTime() - startedAtDate.getTime()) /
    (1000 * 60 * 60);

  /**
   * Calcula a distância rodada na corrida.
   */
  const kmDriven = end_km - start_km;

  /**
   * Calcula o ganho por hora.
   *
   * Se a duração for zero ou inválida, retorna 0 para evitar divisão por zero.
   */
  const gainPerHour =
    durationHours > 0 ? amount / durationHours : 0;

  /**
   * Calcula o ganho por KM.
   *
   * Se o KM rodado for zero ou inválido, retorna 0 para evitar divisão por zero.
   */
  const gainPerKm =
    kmDriven > 0 ? amount / kmDriven : 0;

  /**
   * Atualiza a corrida atual como finalizada.
   *
   * Também salva:
   * - KM final;
   * - valor;
   * - horário de finalização;
   * - ganho por hora;
   * - ganho por KM.
   */
  const { error: finishError } = await supabase
    .from('rides')
    .update({
      status: 'finished',
      end_km,
      amount,
      finished_at: toLocalISOString(finishedAt),
      gain_per_hour: gainPerHour,
      gain_per_km: gainPerKm,
    })
    .eq('id', ride_id);

  /**
   * Se houver erro ao finalizar a corrida, interrompe o processo.
   */
  if (finishError) {
    throw finishError;
  }

  /**
   * Busca se já existe um ganho lançado para a mesma jornada e plataforma.
   *
   * A ideia aqui é somar os valores das corridas da mesma plataforma
   * em um único registro de ganho.
   */
  const { data: existingEarning } = await supabase
    .from('earnings')
    .select('*')
    .eq('session_id', session_id)
    .eq('platform', platform)
    .maybeSingle();

  /**
   * Se já existir ganho para essa plataforma dentro da jornada,
   * soma o valor da corrida ao valor existente.
   */
  if (existingEarning) {
    await supabase
      .from('earnings')
      .update({
        amount: Number(existingEarning.amount) + amount,
      })
      .eq('id', existingEarning.id);
  } else {
    /**
     * Se ainda não existir ganho para essa plataforma na jornada,
     * cria um novo registro na tabela earnings.
     */
    await supabase
      .from('earnings')
      .insert({
        session_id,
        platform,
        category: platform,
        amount,
      });
  }

  /**
   * Atualiza o KM final da jornada.
   *
   * Assim, a jornada passa a refletir o último KM registrado.
   */
  await supabase
    .from('work_sessions')
    .update({
      end_km,
    })
    .eq('id', session_id);

  /**
   * Atualiza o KM atual do veículo.
   *
   * Isso mantém o cadastro do veículo sincronizado com as corridas/jornadas.
   */
  await supabase
    .from('vehicles')
    .update({
      current_km: end_km,
    })
    .eq('id', vehicle_id);

  /**
   * Busca a próxima corrida aguardando início na mesma jornada.
   *
   * A primeira criada será a próxima a iniciar.
   */
  const { data: nextRide } = await supabase
    .from('rides')
    .select('*')
    .eq('session_id', session_id)
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  /**
   * Se existir uma próxima corrida aguardando, ela é iniciada automaticamente.
   *
   * Ela começa:
   * - com status active;
   * - com start_km igual ao KM final da corrida anterior;
   * - com started_at igual ao horário atual.
   */
  if (nextRide) {
    await supabase
      .from('rides')
      .update({
        status: 'active',
        start_km: end_km,
        started_at: toLocalISOString(new Date()),
      })
      .eq('id', nextRide.id);
  }

  /**
   * Retorna um resumo dos cálculos feitos ao finalizar a corrida.
   *
   * Esse retorno pode ser usado pela tela para atualizar UI,
   * exibir métricas ou confirmar os valores calculados.
   */
  return {
    amount,
    gain_per_hour: gainPerHour,
    gain_per_km: gainPerKm,
    km_driven: kmDriven,
  };
}
