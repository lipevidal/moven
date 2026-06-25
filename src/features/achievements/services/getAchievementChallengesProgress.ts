import { supabase } from '../../../database/supabase';

type PeriodTotal = {
  key: string;
  amount: number;
  start: Date;
  end: Date;
};

export type AchievementChallengeProgress = {
  key: string;
  title: string;
  description: string;
  rewardIcon: string;
  rewardLabel: string;
  rewardXp: number;
  progressLabel: string;
  remainingText: string;
  progressPercent: number;
  earnedCount: number;
  statusText: string;
};

export function getDefaultAchievementProgress(): AchievementChallengeProgress[] {
  return [
    createBaseProgress({
      key: 'daily_300_3x',
      title: 'Faça R$ 300,00+ em 1 dia por 3 vezes',
      description: 'Complete 3 dias com faturamento de R$ 300,00 ou mais.',
      rewardIcon: '🥉',
      rewardLabel: 'Medalha de Bronze',
      rewardXp: 10,
      progressLabel: '0/3 dias concluídos',
      remainingText: 'Faltam 3 dias',
      progressPercent: 0,
    }),
    createBaseProgress({
      key: 'weekly_1500_2x',
      title: 'Faça R$ 1.500,00+ em 1 semana por 2 vezes',
      description: 'Complete 2 semanas com faturamento de R$ 1.500,00 ou mais.',
      rewardIcon: '🥈',
      rewardLabel: 'Medalha de Prata',
      rewardXp: 50,
      progressLabel: '0/2 semanas concluídas',
      remainingText: 'Faltam 2 semanas',
      progressPercent: 0,
    }),
    createBaseProgress({
      key: 'monthly_6000_1x',
      title: 'Faça R$ 6.000,00 em 1 mês',
      description: 'Alcance R$ 6.000,00 de faturamento em um mês.',
      rewardIcon: '🥇',
      rewardLabel: 'Medalha de Ouro',
      rewardXp: 100,
      progressLabel: 'R$ 0,00 / R$ 6.000,00',
      remainingText: 'Faltam R$ 6.000,00',
      progressPercent: 0,
    }),
    createBaseProgress({
      key: 'weekly_1500_3_consecutive',
      title: 'Faça R$ 1.500,00+ por 3 semanas seguidas',
      description: 'Mantenha 3 semanas consecutivas faturando R$ 1.500,00 ou mais.',
      rewardIcon: '🏆',
      rewardLabel: 'Troféu',
      rewardXp: 500,
      progressLabel: '0/3 semanas seguidas',
      remainingText: 'Faltam 3 semanas seguidas',
      progressPercent: 0,
    }),
    createBaseProgress({
      key: 'monthly_6000_3_consecutive',
      title: 'Faça R$ 6.000,00+ por 3 meses seguidos',
      description: 'Mantenha 3 meses consecutivos faturando R$ 6.000,00 ou mais.',
      rewardIcon: '💎',
      rewardLabel: 'Diamante',
      rewardXp: 1000,
      progressLabel: '0/3 meses seguidos',
      remainingText: 'Faltam 3 meses seguidos',
      progressPercent: 0,
    }),
  ];
}

export async function getAchievementChallengesProgress(): Promise<AchievementChallengeProgress[]> {
  const defaults = getDefaultAchievementProgress();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) return defaults;

    const { data: earnings, error: earningsError } = await supabase
      .from('earnings')
      .select('amount, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (earningsError) throw earningsError;

    const { data: achievements, error: achievementsError } = await supabase
      .from('user_achievements')
      .select('achievement_key')
      .eq('user_id', user.id);

    if (achievementsError) throw achievementsError;

    const earnedCount = new Map<string, number>();

    for (const item of achievements ?? []) {
      earnedCount.set(
        item.achievement_key,
        (earnedCount.get(item.achievement_key) ?? 0) + 1,
      );
    }

    const dailyTotals = aggregatePeriodTotals(earnings ?? [], 'day');
    const weeklyTotals = aggregatePeriodTotals(earnings ?? [], 'week');
    const monthlyTotals = aggregatePeriodTotals(earnings ?? [], 'month');

    const daily300 = dailyTotals.filter((item) => item.amount >= 300);
    const weekly1500 = weeklyTotals.filter((item) => item.amount >= 1500);
    const monthly6000 = monthlyTotals.filter((item) => item.amount >= 6000);

    const currentMonth = getCurrentPeriodTotal(monthlyTotals, 'month');
    const weeklyStreak = getCurrentStreak(weekly1500, 'week');
    const monthlyStreak = getCurrentStreak(monthly6000, 'month');
    const weeklyCycles = getTotalConsecutiveCycles(weekly1500, 'week', 3);
    const monthlyCycles = getTotalConsecutiveCycles(monthly6000, 'month', 3);

    return [
      buildCountProgress({
        defaultItem: defaults[0],
        totalQualified: daily300.length,
        required: 3,
        unit: 'dias concluídos',
        remainingUnit: 'dias',
        earnedCount: earnedCount.get('daily_300_3x') ?? 0,
      }),
      buildCountProgress({
        defaultItem: defaults[1],
        totalQualified: weekly1500.length,
        required: 2,
        unit: 'semanas concluídas',
        remainingUnit: 'semanas',
        earnedCount: earnedCount.get('weekly_1500_2x') ?? 0,
      }),
      buildMonthlyProgress({
        defaultItem: defaults[2],
        qualifyingMonths: monthly6000.length,
        currentMonthAmount: currentMonth?.amount ?? 0,
        earnedCount: earnedCount.get('monthly_6000_1x') ?? 0,
      }),
      buildStreakProgress({
        defaultItem: defaults[3],
        currentStreak: weeklyStreak,
        totalCycles: weeklyCycles,
        required: 3,
        unit: 'semanas seguidas',
        earnedCount: earnedCount.get('weekly_1500_3_consecutive') ?? 0,
      }),
      buildStreakProgress({
        defaultItem: defaults[4],
        currentStreak: monthlyStreak,
        totalCycles: monthlyCycles,
        required: 3,
        unit: 'meses seguidos',
        earnedCount: earnedCount.get('monthly_6000_3_consecutive') ?? 0,
      }),
    ];
  } catch (error) {
    console.log('Erro ao carregar progresso das conquistas:', error);
    return defaults;
  }
}

function createBaseProgress(item: Omit<AchievementChallengeProgress, 'earnedCount' | 'statusText'>): AchievementChallengeProgress {
  return {
    ...item,
    earnedCount: 0,
    statusText: 'Em andamento',
  };
}

function buildCountProgress({
  defaultItem,
  totalQualified,
  required,
  unit,
  remainingUnit,
  earnedCount,
}: any): AchievementChallengeProgress {
  const currentCycleProgress = Math.max(totalQualified - earnedCount * required, 0);
  const progress = Math.min(currentCycleProgress, required);
  const remaining = Math.max(required - progress, 0);

  return {
    ...defaultItem,
    progressLabel: `${progress}/${required} ${unit}`,
    remainingText: remaining === 0 ? 'Pronto para conquistar' : `Faltam ${remaining} ${remainingUnit}`,
    progressPercent: Math.min((progress / required) * 100, 100),
    earnedCount,
    statusText: earnedCount > 0 ? `Conquistado ${earnedCount}x` : 'Em andamento',
  };
}

function buildMonthlyProgress({
  defaultItem,
  qualifyingMonths,
  currentMonthAmount,
  earnedCount,
}: any): AchievementChallengeProgress {
  const pendingQualified = Math.max(qualifyingMonths - earnedCount, 0);
  const progressAmount = pendingQualified > 0 ? 6000 : Math.min(currentMonthAmount, 6000);
  const remaining = Math.max(6000 - progressAmount, 0);

  return {
    ...defaultItem,
    progressLabel: `R$ ${formatCurrency(progressAmount)} / R$ 6.000,00`,
    remainingText: remaining === 0 ? 'Pronto para conquistar' : `Faltam R$ ${formatCurrency(remaining)}`,
    progressPercent: Math.min((progressAmount / 6000) * 100, 100),
    earnedCount,
    statusText: earnedCount > 0 ? `Conquistado ${earnedCount}x` : 'Em andamento',
  };
}

function buildStreakProgress({
  defaultItem,
  currentStreak,
  totalCycles,
  required,
  unit,
  earnedCount,
}: any): AchievementChallengeProgress {
  const hasPendingCycle = totalCycles > earnedCount;
  const progress = hasPendingCycle ? required : Math.min(currentStreak % required, required);
  const remaining = Math.max(required - progress, 0);

  return {
    ...defaultItem,
    progressLabel: `${progress}/${required} ${unit}`,
    remainingText: remaining === 0 ? 'Pronto para conquistar' : `Faltam ${remaining} ${unit}`,
    progressPercent: Math.min((progress / required) * 100, 100),
    earnedCount,
    statusText: earnedCount > 0 ? `Conquistado ${earnedCount}x` : 'Em andamento',
  };
}

function aggregatePeriodTotals(earnings: any[], periodType: 'day' | 'week' | 'month') {
  const map = new Map<string, PeriodTotal>();

  for (const earning of earnings) {
    const date = new Date(earning.created_at);
    const { key, start, end } = getPeriodInfo(date, periodType);
    const current = map.get(key);

    if (current) {
      current.amount += Number(earning.amount ?? 0);
    } else {
      map.set(key, {
        key,
        amount: Number(earning.amount ?? 0),
        start,
        end,
      });
    }
  }

  return [...map.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

function getCurrentPeriodTotal(totals: PeriodTotal[], periodType: 'month') {
  const now = new Date();
  const { key } = getPeriodInfo(now, periodType);
  return totals.find((item) => item.key === key) ?? null;
}

function getCurrentStreak(totals: PeriodTotal[], periodType: 'week' | 'month') {
  const sorted = [...totals].sort((a, b) => b.start.getTime() - a.start.getTime());
  if (sorted.length === 0) return 0;

  let streak = 1;

  for (let index = 1; index < sorted.length; index++) {
    if (isPreviousPeriod(sorted[index - 1].start, sorted[index].start, periodType)) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function getTotalConsecutiveCycles(
  totals: PeriodTotal[],
  periodType: 'week' | 'month',
  required: number,
) {
  const sorted = [...totals].sort((a, b) => a.start.getTime() - b.start.getTime());
  let streak = 0;
  let cycles = 0;
  let previous: PeriodTotal | null = null;

  for (const current of sorted) {
    if (!previous || isNextPeriod(previous.start, current.start, periodType)) {
      streak += 1;
    } else {
      cycles += Math.floor(streak / required);
      streak = 1;
    }

    previous = current;
  }

  cycles += Math.floor(streak / required);
  return cycles;
}

function getPeriodInfo(date: Date, periodType: 'day' | 'week' | 'month') {
  if (periodType === 'day') {
    const start = startOfDay(date);
    const end = endOfDay(date);
    return { key: formatDateKey(start), start, end };
  }

  if (periodType === 'week') {
    const start = startOfWeekMonday(date);
    const end = endOfDay(addDays(start, 6));
    return { key: formatDateKey(start), start, end };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`, start, end };
}

function isNextPeriod(previous: Date, current: Date, periodType: 'week' | 'month') {
  const expected = new Date(previous);

  if (periodType === 'week') {
    expected.setDate(previous.getDate() + 7);
    return startOfWeekMonday(expected).getTime() === startOfWeekMonday(current).getTime();
  }

  expected.setMonth(previous.getMonth() + 1);
  return expected.getFullYear() === current.getFullYear() && expected.getMonth() === current.getMonth();
}

function isPreviousPeriod(current: Date, previous: Date, periodType: 'week' | 'month') {
  return isNextPeriod(previous, current, periodType);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = startOfDay(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
