import { supabase } from '../../../database/supabase';

export type MetricStatus = 'above' | 'intermediate' | 'below' | 'empty';
export type EarningsPerformanceName = 'Excelente' | 'Muito bom' | 'Bom' | 'Regular' | 'Ruim' | 'Sem dados';
export type ExpensePerformanceName =
  | 'Despesas controladas'
  | 'Despesas saudáveis'
  | 'Despesas em atenção'
  | 'Despesas altas'
  | 'Despesas críticas'
  | 'Sem dados';

export type OverallPerformanceLevel =
  | 'very_worth'
  | 'worth'
  | 'adjustments'
  | 'review_strategy'
  | 'not_compensating'
  | 'critical'
  | 'no_data';

export type EarningsPerformanceAnalysis = {
  periodDays: number;
  maxPeriodDays: number;
  usesAvailableDays: boolean;
  startDate: string;
  endDate: string;
  revenue: number;
  sessionRevenue: number;
  standaloneRevenue: number;
  expenses: number;
  profit: number;
  profitMarginPercent: number;
  expensesPercent: number;
  totalHours: number;
  totalKm: number;
  averageRevenuePerDay: number;
  averageProfitPerDay: number;
  revenuePerHour: number;
  revenuePerKm: number;
  activeDays: number;
  sessionCount: number;
  targets: {
    badGainPerHour: number;
    goodGainPerHour: number;
    badGainPerKm: number;
    goodGainPerKm: number;
  };
  hourStatus: MetricStatus;
  kmStatus: MetricStatus;
  earningsPerformance: {
    name: EarningsPerformanceName;
    message: string;
    color: string;
    iconName: string;
  };
  expensesPerformance: {
    name: ExpensePerformanceName;
    message: string;
    color: string;
    iconName: string;
  };
  overall: {
    level: OverallPerformanceLevel;
    title: string;
    message: string;
    recommendation: string;
    color: string;
    backgroundColor: string;
    borderColor: string;
    iconName: string;
  };
  alerts: string[];
  strengths: string[];
};

const DEFAULT_TARGETS = {
  badGainPerHour: 40,
  goodGainPerHour: 45,
  badGainPerKm: 2,
  goodGainPerKm: 2.5,
};

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
}

function getLocalDateKey(value: Date | string | null | undefined) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function calculateSessionHours(session: any) {
  if (!session?.started_at || !session?.finished_at) return 0;

  const startedAt = new Date(session.started_at).getTime();
  const finishedAt = new Date(session.finished_at).getTime();
  const pausedSeconds = Number(session.total_paused_seconds ?? 0);

  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt) || finishedAt <= startedAt) {
    return 0;
  }

  const totalSeconds = Math.max(
    Math.floor((finishedAt - startedAt) / 1000) - pausedSeconds,
    0,
  );

  return totalSeconds / 3600;
}

function calculateSessionKm(session: any) {
  return Math.max(Number(session?.end_km ?? 0) - Number(session?.start_km ?? 0), 0);
}

function calculateSessionRevenue(session: any) {
  const earnings = session?.earnings ?? [];

  /*
    A tabela work_sessions não possui a coluna total_earnings.
    Por isso o faturamento da jornada é calculado pelos ganhos vinculados
    na tabela earnings.
  */
  if (Array.isArray(earnings) && earnings.length > 0) {
    return earnings.reduce(
      (total: number, earning: any) => total + Number(earning?.amount ?? 0),
      0,
    );
  }

  return 0;
}

function classifyMetric(value: number, bad: number, good: number): MetricStatus {
  if (!value || value <= 0) return 'empty';
  if (value >= good) return 'above';
  if (value >= bad) return 'intermediate';

  return 'below';
}

function statusLabel(status: MetricStatus) {
  if (status === 'above') return 'Acima do esperado';
  if (status === 'intermediate') return 'Intermediário';
  if (status === 'below') return 'Abaixo do esperado';

  return 'Sem dados';
}

function buildEarningsPerformance(hourStatus: MetricStatus, kmStatus: MetricStatus) {
  if (hourStatus === 'empty' || kmStatus === 'empty') {
    return {
      name: 'Sem dados' as EarningsPerformanceName,
      color: '#71717A',
      iconName: 'analytics-outline',
      message:
        'Ainda não há dados suficientes de horas e quilômetros para avaliar seus ganhos com precisão.',
    };
  }

  if (hourStatus === 'above' && kmStatus === 'above') {
    return {
      name: 'Excelente' as EarningsPerformanceName,
      color: '#22C55E',
      iconName: 'rocket-outline',
      message:
        'Seu desempenho está excelente. Seus ganhos por hora e por quilômetro estão dentro ou acima da meta definida. Isso indica uma jornada muito produtiva e bem aproveitada.',
    };
  }

  if (
    (hourStatus === 'above' && kmStatus === 'intermediate') ||
    (hourStatus === 'intermediate' && kmStatus === 'above')
  ) {
    return {
      name: 'Muito bom' as EarningsPerformanceName,
      color: '#84CC16',
      iconName: 'trending-up-outline',
      message:
        'Seu desempenho está muito bom. Um dos indicadores superou a meta e o outro ficou próximo do esperado. Pequenos ajustes podem deixar seus ganhos ainda melhores.',
    };
  }

  if (
    (hourStatus === 'intermediate' && kmStatus === 'intermediate') ||
    (hourStatus === 'above' && kmStatus === 'below') ||
    (hourStatus === 'below' && kmStatus === 'above')
  ) {
    return {
      name: 'Bom' as EarningsPerformanceName,
      color: '#FACC15',
      iconName: 'thumbs-up-outline',
      message:
        'Seu desempenho está bom, mas ainda pode melhorar. Seus ganhos não foram ruins, porém existe desequilíbrio entre tempo trabalhado e quilômetros rodados.',
    };
  }

  if (
    (hourStatus === 'intermediate' && kmStatus === 'below') ||
    (hourStatus === 'below' && kmStatus === 'intermediate')
  ) {
    return {
      name: 'Regular' as EarningsPerformanceName,
      color: '#FB923C',
      iconName: 'options-outline',
      message:
        'Seu desempenho está regular. Um dos indicadores ficou em uma faixa aceitável, mas o outro ficou abaixo do mínimo esperado. Avalie melhor as corridas, horários e regiões para melhorar o resultado.',
    };
  }

  return {
    name: 'Ruim' as EarningsPerformanceName,
    color: '#EF4444',
    iconName: 'warning-outline',
    message:
      'Seu desempenho está ruim. Seus ganhos por hora e por quilômetro ficaram abaixo do mínimo esperado. Isso pode indicar que você trabalhou muito, rodou bastante e teve pouco retorno financeiro.',
  };
}

function buildExpensesPerformance(expensesPercent: number, revenue: number) {
  if (revenue <= 0) {
    return {
      name: 'Sem dados' as ExpensePerformanceName,
      color: '#71717A',
      iconName: 'receipt-outline',
      message:
        'Ainda não há faturamento suficiente para comparar suas despesas com a receita do período.',
    };
  }

  if (expensesPercent < 20) {
    return {
      name: 'Despesas controladas' as ExpensePerformanceName,
      color: '#22C55E',
      iconName: 'shield-checkmark-outline',
      message:
        'Suas despesas estão excelentes. Você manteve os custos bem controlados em relação ao faturamento, o que aumenta seu lucro final.',
    };
  }

  if (expensesPercent < 35) {
    return {
      name: 'Despesas saudáveis' as ExpensePerformanceName,
      color: '#84CC16',
      iconName: 'checkmark-circle-outline',
      message:
        'Suas despesas estão boas. Seus custos estão dentro de uma faixa saudável, mas ainda existe espaço para melhorar sua margem de lucro.',
    };
  }

  if (expensesPercent < 50) {
    return {
      name: 'Despesas em atenção' as ExpensePerformanceName,
      color: '#FACC15',
      iconName: 'alert-outline',
      message:
        'Atenção às despesas. Uma parte considerável do seu faturamento está sendo consumida pelos custos. Avalie combustível, manutenção, alimentação e outros gastos do período.',
    };
  }

  if (expensesPercent < 60) {
    return {
      name: 'Despesas altas' as ExpensePerformanceName,
      color: '#FB923C',
      iconName: 'trending-down-outline',
      message:
        'Suas despesas estão altas. Mais da metade do faturamento está sendo consumida pelos custos, reduzindo bastante o lucro do período.',
    };
  }

  return {
    name: 'Despesas críticas' as ExpensePerformanceName,
    color: '#EF4444',
    iconName: 'alert-circle-outline',
    message:
      'Suas despesas estão em nível crítico. Os custos estão consumindo grande parte do faturamento e podem comprometer seu lucro. Revise seus principais gastos com urgência.',
  };
}

function getOverallAnalysis(params: {
  earningsName: EarningsPerformanceName;
  expensesPercent: number;
  revenue: number;
  profit: number;
  profitMarginPercent: number;
  hourStatus: MetricStatus;
  kmStatus: MetricStatus;
}) {
  const {
    earningsName,
    expensesPercent,
    revenue,
    profit,
    profitMarginPercent,
    hourStatus,
    kmStatus,
  } = params;

  if (revenue <= 0) {
    return {
      level: 'no_data' as OverallPerformanceLevel,
      title: 'Ainda não há dados suficientes',
      message:
        'Cadastre jornadas, ganhos, quilômetros e despesas para que o MovenApp avalie se está valendo a pena rodar.',
      recommendation:
        'Depois de alguns dias de uso, volte aqui para acompanhar sua análise com base nos dias disponíveis dentro dos últimos 100 dias.',
      color: '#A1A1AA',
      backgroundColor: '#18181B',
      borderColor: '#27272A',
      iconName: 'analytics-outline',
    };
  }

  const healthyExpenses = expensesPercent < 35;
  const attentionExpenses = expensesPercent >= 35 && expensesPercent < 50;
  const highExpenses = expensesPercent >= 50 && expensesPercent < 60;
  const criticalExpenses = expensesPercent >= 60;
  const profitCritical = profit <= 0 || profitMarginPercent < 10;
  const gainsGood = ['Excelente', 'Muito bom', 'Bom'].includes(earningsName);
  const gainsStrong = earningsName === 'Excelente' || earningsName === 'Muito bom';
  const gainsWeak = earningsName === 'Regular' || earningsName === 'Ruim';
  const unbalancedGoodBad =
    (hourStatus === 'above' && kmStatus === 'below') ||
    (hourStatus === 'below' && kmStatus === 'above');

  if (criticalExpenses || (profitCritical && expensesPercent >= 50)) {
    return {
      level: 'critical' as OverallPerformanceLevel,
      title: 'Sua operação está em situação crítica',
      message:
        'Sua operação está em situação crítica. As despesas estão consumindo grande parte do faturamento e o retorno por hora ou por quilômetro não está compensando.',
      recommendation:
        'Reveja não só sua estratégia, mas também o veículo utilizado. Custos com combustível, manutenção, financiamento, seguro ou desgaste podem estar reduzindo muito seu lucro real.',
      color: '#EF4444',
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderColor: 'rgba(239,68,68,0.30)',
      iconName: 'alert-circle-outline',
    };
  }

  if (earningsName === 'Ruim' && (highExpenses || expensesPercent >= 50)) {
    return {
      level: 'not_compensating' as OverallPerformanceLevel,
      title: 'Sua estratégia não está compensando',
      message:
        'Seus ganhos estão abaixo do esperado e suas despesas estão altas. Esse cenário reduz muito seu lucro e pode fazer você trabalhar bastante sem ter um retorno financeiro adequado.',
      recommendation:
        'Reveja sua estratégia com urgência. Pode ser necessário mudar horários, regiões, plataformas, reduzir custos ou até avaliar se o veículo atual está prejudicando seu resultado.',
      color: '#F87171',
      backgroundColor: 'rgba(248,113,113,0.12)',
      borderColor: 'rgba(248,113,113,0.30)',
      iconName: 'warning-outline',
    };
  }

  if ((gainsWeak && (attentionExpenses || highExpenses)) || highExpenses) {
    return {
      level: 'review_strategy' as OverallPerformanceLevel,
      title: 'Sua estratégia precisa ser revisada',
      message:
        'Atenção: sua estratégia precisa ser revisada. Seus ganhos não estão ruins em todos os pontos, mas as despesas estão consumindo uma parte importante do faturamento.',
      recommendation:
        'Mude horários de trabalho, evite regiões pouco rentáveis, selecione melhor as corridas e compare o desempenho entre plataformas. Rodar mais nem sempre significa lucrar mais.',
      color: '#FB923C',
      backgroundColor: 'rgba(251,146,60,0.12)',
      borderColor: 'rgba(251,146,60,0.30)',
      iconName: 'compass-outline',
    };
  }

  if (attentionExpenses || unbalancedGoodBad || earningsName === 'Regular') {
    return {
      level: 'adjustments' as OverallPerformanceLevel,
      title: 'Sua estratégia está boa, mas precisa de ajustes',
      message:
        'Seu resultado ainda pode valer a pena, mas precisa de ajustes. Existe algum ponto reduzindo sua eficiência: pode ser excesso de quilômetros rodados, muito tempo parado, escolha ruim de horários ou despesas começando a pesar.',
      recommendation:
        'Analise quais corridas, regiões e plataformas estão trazendo melhor retorno. Pequenas mudanças na estratégia podem aumentar bastante seu lucro.',
      color: '#FACC15',
      backgroundColor: 'rgba(250,204,21,0.12)',
      borderColor: 'rgba(250,204,21,0.30)',
      iconName: 'construct-outline',
    };
  }

  if (gainsStrong && healthyExpenses) {
    return {
      level: 'very_worth' as OverallPerformanceLevel,
      title: 'Sua estratégia está excelente',
      message:
        'Seu resultado está muito positivo. Você está ganhando bem por hora, rodando com boa rentabilidade por quilômetro e mantendo as despesas controladas.',
      recommendation:
        'Continue priorizando os horários, regiões e plataformas que estão trazendo esse resultado.',
      color: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.13)',
      borderColor: 'rgba(34,197,94,0.34)',
      iconName: 'rocket-outline',
    };
  }

  if (gainsGood && healthyExpenses) {
    return {
      level: 'worth' as OverallPerformanceLevel,
      title: 'Sua estratégia está muito boa',
      message:
        'Seu resultado está saudável. Seus ganhos estão dentro de uma faixa aceitável e as despesas ainda não estão comprometendo muito o faturamento.',
      recommendation:
        'Acompanhe os custos e busque melhorar os ganhos por hora ou por quilômetro para aumentar seu lucro.',
      color: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.30)',
      iconName: 'checkmark-circle-outline',
    };
  }

  return {
    level: 'adjustments' as OverallPerformanceLevel,
    title: 'Sua estratégia está boa, mas precisa de ajustes',
    message:
      'Seu resultado tem pontos positivos, mas ainda existe espaço para melhorar a eficiência da operação.',
    recommendation:
      'Compare horários, regiões, plataformas e custos do veículo para entender onde o lucro está sendo reduzido.',
    color: '#FACC15',
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderColor: 'rgba(250,204,21,0.30)',
    iconName: 'construct-outline',
  };
}

function buildHighlights(params: {
  hourStatus: MetricStatus;
  kmStatus: MetricStatus;
  expensesPercent: number;
  profitMarginPercent: number;
  revenuePerHour: number;
  revenuePerKm: number;
}) {
  const alerts: string[] = [];
  const strengths: string[] = [];

  if (params.hourStatus === 'above') {
    strengths.push('Seu ganho por hora está acima da meta definida.');
  }

  if (params.kmStatus === 'above') {
    strengths.push('Seu ganho por quilômetro está acima da meta definida.');
  }

  if (params.expensesPercent < 35) {
    strengths.push('Suas despesas estão em uma faixa saudável em relação ao faturamento.');
  }

  if (params.profitMarginPercent >= 50) {
    strengths.push('Sua margem de lucro está forte no período analisado.');
  }

  if (params.hourStatus === 'below') {
    alerts.push('O ganho por hora está abaixo do mínimo aceitável. Reveja horários e regiões.');
  }

  if (params.kmStatus === 'below') {
    alerts.push('O ganho por quilômetro está baixo. Evite deslocamentos longos e corridas pouco rentáveis.');
  }

  if (params.expensesPercent >= 50) {
    alerts.push('As despesas estão consumindo uma parte alta do faturamento.');
  }

  if (params.profitMarginPercent < 20) {
    alerts.push('A margem de lucro está baixa. Verifique custos fixos e variáveis.');
  }

  return {
    alerts,
    strengths,
  };
}

async function getPerformanceTargets(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_performance_targets')
      .select('bad_gain_per_hour, good_gain_per_hour, bad_gain_per_km, good_gain_per_km')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    const badGainPerHour = Number(data?.bad_gain_per_hour ?? DEFAULT_TARGETS.badGainPerHour);
    const goodGainPerHour = Number(data?.good_gain_per_hour ?? DEFAULT_TARGETS.goodGainPerHour);
    const badGainPerKm = Number(data?.bad_gain_per_km ?? DEFAULT_TARGETS.badGainPerKm);
    const goodGainPerKm = Number(data?.good_gain_per_km ?? DEFAULT_TARGETS.goodGainPerKm);

    if (
      !badGainPerHour ||
      !goodGainPerHour ||
      badGainPerHour >= goodGainPerHour ||
      !badGainPerKm ||
      !goodGainPerKm ||
      badGainPerKm >= goodGainPerKm
    ) {
      return DEFAULT_TARGETS;
    }

    return {
      badGainPerHour,
      goodGainPerHour,
      badGainPerKm,
      goodGainPerKm,
    };
  } catch (error) {
    console.log('Erro ao carregar parâmetros de desempenho geral:', error);
    return DEFAULT_TARGETS;
  }
}

export function getMetricStatusLabel(status: MetricStatus) {
  return statusLabel(status);
}

export async function getEarningsPerformanceAnalysis(): Promise<EarningsPerformanceAnalysis> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!user?.id) {
    throw new Error('Usuário não autenticado.');
  }

  const maxPeriodDays = 100;
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (maxPeriodDays - 1));
  startDate.setHours(0, 0, 0, 0);

  const searchStart = new Date(startDate);
  searchStart.setDate(searchStart.getDate() - 1);

  const searchEnd = new Date(endDate);
  searchEnd.setDate(searchEnd.getDate() + 1);

  const [targets, sessionsResponse, standaloneEarningsResponse, expensesResponse] =
    await Promise.all([
      getPerformanceTargets(user.id),
      supabase
        .from('work_sessions')
        .select(
          `
          id,
          started_at,
          finished_at,
          start_km,
          end_km,
          total_paused_seconds,
          status,
          earnings(id, amount, earning_date, created_at)
          `,
        )
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .gte('started_at', toLocalISOString(searchStart))
        .lte('started_at', toLocalISOString(searchEnd)),
      supabase
        .from('earnings')
        .select('id, session_id, amount, earning_date, created_at')
        .eq('user_id', user.id)
        .is('session_id', null)
        .gte('earning_date', toLocalISOString(searchStart))
        .lte('earning_date', toLocalISOString(searchEnd)),
      supabase
        .from('expenses')
        .select('id, amount, expense_date, created_at')
        .eq('user_id', user.id)
        .gte('expense_date', toLocalISOString(searchStart))
        .lte('expense_date', toLocalISOString(searchEnd)),
    ]);

  if (sessionsResponse.error) throw sessionsResponse.error;
  if (standaloneEarningsResponse.error) throw standaloneEarningsResponse.error;
  if (expensesResponse.error) throw expensesResponse.error;

  const startKey = getLocalDateKey(startDate);
  const endKey = getLocalDateKey(endDate);

  function isInsidePeriod(value: string | null | undefined) {
    const key = getLocalDateKey(value);

    return key >= startKey && key <= endKey;
  }

  const sessions = (sessionsResponse.data ?? []).filter((session: any) =>
    isInsidePeriod(session.started_at),
  );

  const standaloneEarnings = (standaloneEarningsResponse.data ?? []).filter((earning: any) =>
    isInsidePeriod(earning.earning_date ?? earning.created_at),
  );

  const expensesList = (expensesResponse.data ?? []).filter((expense: any) =>
    isInsidePeriod(expense.expense_date ?? expense.created_at),
  );

  const sessionRevenue = sessions.reduce(
    (total: number, session: any) => total + calculateSessionRevenue(session),
    0,
  );

  const standaloneRevenue = standaloneEarnings.reduce(
    (total: number, earning: any) => total + Number(earning?.amount ?? 0),
    0,
  );

  const revenue = sessionRevenue + standaloneRevenue;

  const expenses = expensesList.reduce(
    (total: number, expense: any) => total + Number(expense?.amount ?? 0),
    0,
  );

  const profit = revenue - expenses;
  const totalHours = sessions.reduce(
    (total: number, session: any) => total + calculateSessionHours(session),
    0,
  );
  const totalKm = sessions.reduce(
    (total: number, session: any) => total + calculateSessionKm(session),
    0,
  );

  const revenuePerHour = totalHours > 0 ? revenue / totalHours : 0;
  const revenuePerKm = totalKm > 0 ? revenue / totalKm : 0;
  const expensesPercent = revenue > 0 ? Math.round((expenses / revenue) * 100) : 0;
  const profitMarginPercent = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const activeDayKeys = new Set<string>();

  sessions.forEach((session: any) => {
    const key = getLocalDateKey(session.started_at);
    if (key) activeDayKeys.add(key);
  });

  standaloneEarnings.forEach((earning: any) => {
    const key = getLocalDateKey(earning.earning_date ?? earning.created_at);
    if (key) activeDayKeys.add(key);
  });

  const sortedActiveDayKeys = Array.from(activeDayKeys).sort();
  const activeDays = activeDayKeys.size;

  /*
    Regra:
    A análise procura registros dentro dos últimos 100 dias.
    Porém, enquanto o usuário ainda não tiver 100 dias com dados,
    o resultado é baseado somente nos dias que já possuem registros.
  */
  const effectiveStartDate =
    sortedActiveDayKeys.length > 0
      ? new Date(`${sortedActiveDayKeys[0]}T12:00:00`)
      : startDate;

  const effectiveEndDate =
    sortedActiveDayKeys.length > 0
      ? new Date(`${sortedActiveDayKeys[sortedActiveDayKeys.length - 1]}T12:00:00`)
      : endDate;

  const periodDays = activeDays > 0 ? Math.min(activeDays, maxPeriodDays) : 0;
  const usesAvailableDays = activeDays < maxPeriodDays;

  const averageRevenuePerDay = activeDays > 0 ? revenue / activeDays : 0;
  const averageProfitPerDay = activeDays > 0 ? profit / activeDays : 0;

  const hourStatus = classifyMetric(
    revenuePerHour,
    targets.badGainPerHour,
    targets.goodGainPerHour,
  );
  const kmStatus = classifyMetric(revenuePerKm, targets.badGainPerKm, targets.goodGainPerKm);
  const earningsPerformance = buildEarningsPerformance(hourStatus, kmStatus);
  const expensesPerformance = buildExpensesPerformance(expensesPercent, revenue);
  const overall = getOverallAnalysis({
    earningsName: earningsPerformance.name,
    expensesPercent,
    revenue,
    profit,
    profitMarginPercent,
    hourStatus,
    kmStatus,
  });
  const highlights = buildHighlights({
    hourStatus,
    kmStatus,
    expensesPercent,
    profitMarginPercent,
    revenuePerHour,
    revenuePerKm,
  });

  return {
    periodDays,
    maxPeriodDays,
    usesAvailableDays,
    startDate: toLocalISOString(effectiveStartDate),
    endDate: toLocalISOString(effectiveEndDate),
    revenue,
    sessionRevenue,
    standaloneRevenue,
    expenses,
    profit,
    profitMarginPercent,
    expensesPercent,
    totalHours,
    totalKm,
    averageRevenuePerDay,
    averageProfitPerDay,
    revenuePerHour,
    revenuePerKm,
    activeDays,
    sessionCount: sessions.length,
    targets,
    hourStatus,
    kmStatus,
    earningsPerformance,
    expensesPerformance,
    overall,
    alerts: highlights.alerts,
    strengths: highlights.strengths,
  };
}
