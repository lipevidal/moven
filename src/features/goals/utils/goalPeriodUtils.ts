/**
 * Tipos de período usados pelo sistema de metas.
 *
 * Esses são os valores padronizados que serão salvos e consultados
 * na tabela de metas.
 */
export type GoalPeriodType = 'day' | 'week' | 'month' | 'year';

/**
 * Tipos de período que podem chegar do Dashboard.
 *
 * O Dashboard pode trabalhar com valores em inglês ou português.
 * Por isso, esse type aceita as duas formas.
 *
 * Depois, a função normalizeGoalPeriod converte tudo para o padrão:
 * - day
 * - week
 * - month
 * - year
 */
export type DashboardPeriod =
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | 'dia'
  | 'semana'
  | 'mes'
  | 'mês'
  | 'ano';

/**
 * Informações completas do período de uma meta.
 *
 * periodType:
 * - tipo do período já normalizado.
 *
 * periodKey:
 * - chave única do período.
 * - exemplo:
 *   - dia: 2026-07-13
 *   - semana: data da segunda-feira da semana
 *   - mês: 2026-07
 *   - ano: 2026
 *
 * periodStart:
 * - início do período em formato ISO.
 *
 * periodEnd:
 * - fim do período em formato ISO.
 */
export type GoalPeriodInfo = {
  periodType: GoalPeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
};

/**
 * Normaliza o período recebido do Dashboard para o padrão usado nas metas.
 *
 * Exemplo:
 * - dia vira day;
 * - semana vira week;
 * - mes/mês vira month;
 * - ano vira year.
 *
 * Se o período já estiver em inglês, retorna ele mesmo.
 */
export function normalizeGoalPeriod(period: DashboardPeriod): GoalPeriodType {
  if (period === 'dia') return 'day';
  if (period === 'semana') return 'week';
  if (period === 'mes' || period === 'mês') return 'month';
  if (period === 'ano') return 'year';

  return period;
}

/**
 * Converte o período selecionado no Dashboard em um período de meta.
 *
 * Essa função é usada para transformar:
 * - o tipo selecionado no Dashboard;
 * - a data de referência selecionada;
 *
 * em:
 * - periodType;
 * - periodKey;
 * - periodStart;
 * - periodEnd.
 *
 * Assim, o sistema consegue buscar, criar ou editar a meta correta
 * para o dia, semana, mês ou ano selecionado.
 */
export function getGoalPeriodFromDashboard(
  selectedPeriod: DashboardPeriod,
  selectedDate: Date | string = new Date(),
): GoalPeriodInfo {
  /**
   * Converte o período recebido para o padrão oficial das metas.
   */
  const periodType = normalizeGoalPeriod(selectedPeriod);

  /**
   * Garante que a data recebida seja tratada como Date.
   */
  const baseDate = new Date(selectedDate);

  /**
   * Período diário.
   *
   * A meta do dia começa às 00:00:00.000
   * e termina às 23:59:59.999 da mesma data.
   */
  if (periodType === 'day') {
    const start = startOfDay(baseDate);
    const end = endOfDay(baseDate);

    return {
      periodType,
      periodKey: formatDateKey(start),
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  }

  /**
   * Período semanal.
   *
   * A semana começa na segunda-feira e termina no domingo.
   *
   * O periodKey usa a data da segunda-feira da semana,
   * garantindo uma chave única para aquela semana.
   */
  if (periodType === 'week') {
    const start = startOfWeekMonday(baseDate);
    const end = endOfDay(addDays(start, 6));

    return {
      periodType,
      periodKey: formatDateKey(start),
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  }

  /**
   * Período mensal.
   *
   * Começa no primeiro dia do mês às 00:00:00.000
   * e termina no último dia do mês às 23:59:59.999.
   *
   * O periodKey fica no formato YYYY-MM.
   */
  if (periodType === 'month') {
    const start = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );

    const end = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    return {
      periodType,
      periodKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  }

  /**
   * Período anual.
   *
   * Começa em 1º de janeiro às 00:00:00.000
   * e termina em 31 de dezembro às 23:59:59.999.
   *
   * O periodKey fica somente com o ano.
   */
  const start = new Date(
    baseDate.getFullYear(),
    0,
    1,
    0,
    0,
    0,
    0,
  );

  const end = new Date(
    baseDate.getFullYear(),
    11,
    31,
    23,
    59,
    59,
    999,
  );

  return {
    periodType,
    periodKey: String(start.getFullYear()),
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

/**
 * Retorna o início do dia da data recebida.
 */
function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

/**
 * Retorna o fim do dia da data recebida.
 */
function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

/**
 * Retorna a segunda-feira da semana da data informada.
 *
 * Regras:
 * - se a data for domingo, volta 6 dias;
 * - se for qualquer outro dia, volta até a segunda-feira.
 */
function startOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = startOfDay(date);

  monday.setDate(date.getDate() + diff);

  return monday;
}

/**
 * Soma uma quantidade de dias a uma data.
 *
 * Usada principalmente para calcular o fim da semana,
 * adicionando 6 dias à segunda-feira.
 */
function addDays(date: Date, days: number) {
  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;
}

/**
 * Formata uma data no padrão YYYY-MM-DD.
 *
 * Esse formato é usado como chave única para metas diárias
 * e também para representar o início da semana.
 */
function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
