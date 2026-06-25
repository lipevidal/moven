import { supabase } from '../../../database/supabase';
import { addXp } from '../../gamification/services/addXp';
import { createNotification } from '../../notifications/services/createNotification';

type PeriodTotal = {
  key: string;
  amount: number;
  start: Date;
  end: Date;
};

type AwardRule = {
  key: string;
  title: string;
  rewardKind: string;
  rewardLabel: string;
  rewardXp: number;
  icon: string;
};

const rules: Record<string, AwardRule> = {
  daily_300_3x: {
    key: 'daily_300_3x',
    title: 'Ritmo forte no dia',
    rewardKind: 'medal_silver',
    rewardLabel: 'Medalha de Prata',
    rewardXp: 10,
    icon: '🥈',
  },
  weekly_1500_2x: {
    key: 'weekly_1500_2x',
    title: 'Semana produtiva',
    rewardKind: 'medal_silver',
    rewardLabel: 'Medalha de Prata',
    rewardXp: 50,
    icon: '🥈',
  },
  monthly_6000_1x: {
    key: 'monthly_6000_1x',
    title: 'Mês de ouro',
    rewardKind: 'medal_gold',
    rewardLabel: 'Medalha de Ouro',
    rewardXp: 100,
    icon: '🥇',
  },
  weekly_1500_3_consecutive: {
    key: 'weekly_1500_3_consecutive',
    title: 'Constância de elite',
    rewardKind: 'trophy',
    rewardLabel: 'Troféu',
    rewardXp: 500,
    icon: '🏆',
  },
  monthly_6000_3_consecutive: {
    key: 'monthly_6000_3_consecutive',
    title: 'Diamante da consistência',
    rewardKind: 'diamond',
    rewardLabel: 'Diamante',
    rewardXp: 1000,
    icon: '💎',
  },
};

export async function evaluateAutomaticAchievements() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return [];
  }

  const { data: earnings, error: earningsError } = await supabase
    .from('earnings')
    .select('amount, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (earningsError) {
    throw earningsError;
  }

  const dailyTotals = aggregatePeriodTotals(earnings ?? [], 'day');
  const weeklyTotals = aggregatePeriodTotals(earnings ?? [], 'week');
  const monthlyTotals = aggregatePeriodTotals(earnings ?? [], 'month');

  const eligibleAwards = [
    ...buildCountAwards(
      rules.daily_300_3x,
      dailyTotals.filter((item) => item.amount >= 300),
      3,
    ),
    ...buildCountAwards(
      rules.weekly_1500_2x,
      weeklyTotals.filter((item) => item.amount >= 1500),
      2,
    ),
    ...buildCountAwards(
      rules.monthly_6000_1x,
      monthlyTotals.filter((item) => item.amount >= 6000),
      1,
    ),
    ...buildConsecutiveAwards(
      rules.weekly_1500_3_consecutive,
      weeklyTotals.filter((item) => item.amount >= 1500),
      3,
      'week',
    ),
    ...buildConsecutiveAwards(
      rules.monthly_6000_3_consecutive,
      monthlyTotals.filter((item) => item.amount >= 6000),
      3,
      'month',
    ),
  ];

  const { data: existing, error: existingError } = await supabase
    .from('user_achievements')
    .select('achievement_key, cycle_number')
    .eq('user_id', user.id);

  if (existingError) {
    throw existingError;
  }

  const existingSet = new Set(
    (existing ?? []).map(
      (item) => `${item.achievement_key}:${item.cycle_number}`,
    ),
  );

  const granted: any[] = [];

  for (const award of eligibleAwards) {
    const uniqueKey = `${award.rule.key}:${award.cycleNumber}`;

    if (existingSet.has(uniqueKey)) continue;

    const { error: insertError } = await supabase
      .from('user_achievements')
      .insert({
        user_id: user.id,
        achievement_key: award.rule.key,
        cycle_number: award.cycleNumber,
        reward_kind: award.rule.rewardKind,
        reward_label: award.rule.rewardLabel,
        reward_xp: award.rule.rewardXp,
        source_period_start: award.sourceStart.toISOString(),
        source_period_end: award.sourceEnd.toISOString(),
      });

    if (insertError) {
      if (insertError.code === '23505') continue;
      throw insertError;
    }

    await addXp(
      user.id,
      award.rule.rewardXp,
      `Conquista: ${award.rule.title}`,
    );

    await createNotification(
      user.id,
      `${award.rule.icon} Nova conquista!`,
      `Você ganhou ${award.rule.rewardLabel} em "${award.rule.title}" e recebeu ${award.rule.rewardXp} XP.`,
      'achievement_unlocked',
      `${award.rule.key}:${award.cycleNumber}`,
    );

    granted.push(award);
  }

  return granted;
}

function buildCountAwards(
  rule: AwardRule,
  qualifyingPeriods: PeriodTotal[],
  requiredCount: number,
) {
  const awards: any[] = [];
  const cycles = Math.floor(qualifyingPeriods.length / requiredCount);

  for (let index = 1; index <= cycles; index++) {
    const startIndex = (index - 1) * requiredCount;
    const endIndex = index * requiredCount - 1;
    const sourceStart = qualifyingPeriods[startIndex]?.start ?? new Date();
    const sourceEnd = qualifyingPeriods[endIndex]?.end ?? new Date();

    awards.push({
      rule,
      cycleNumber: index,
      sourceStart,
      sourceEnd,
    });
  }

  return awards;
}

function buildConsecutiveAwards(
  rule: AwardRule,
  qualifyingPeriods: PeriodTotal[],
  requiredCount: number,
  periodType: 'week' | 'month',
) {
  const awards: any[] = [];
  const sorted = [...qualifyingPeriods].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  let streak: PeriodTotal[] = [];
  let cycleNumber = 1;

  for (const period of sorted) {
    const previous = streak[streak.length - 1];

    if (!previous || isNextPeriod(previous.start, period.start, periodType)) {
      streak.push(period);
    } else {
      cycleNumber = pushConsecutiveCycles(
        awards,
        rule,
        streak,
        requiredCount,
        cycleNumber,
      );
      streak = [period];
    }
  }

  pushConsecutiveCycles(
    awards,
    rule,
    streak,
    requiredCount,
    cycleNumber,
  );

  return awards;
}

function pushConsecutiveCycles(
  awards: any[],
  rule: AwardRule,
  streak: PeriodTotal[],
  requiredCount: number,
  startCycleNumber: number,
) {
  const cycles = Math.floor(streak.length / requiredCount);
  let cycleNumber = startCycleNumber;

  for (let index = 0; index < cycles; index++) {
    const startIndex = index * requiredCount;
    const endIndex = startIndex + requiredCount - 1;

    awards.push({
      rule,
      cycleNumber,
      sourceStart: streak[startIndex].start,
      sourceEnd: streak[endIndex].end,
    });

    cycleNumber += 1;
  }

  return cycleNumber;
}

function aggregatePeriodTotals(
  earnings: any[],
  periodType: 'day' | 'week' | 'month',
) {
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

  return [...map.values()].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
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

  return {
    key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    start,
    end,
  };
}

function isNextPeriod(
  previous: Date,
  current: Date,
  periodType: 'week' | 'month',
) {
  const expected = new Date(previous);

  if (periodType === 'week') {
    expected.setDate(previous.getDate() + 7);
    return startOfWeekMonday(expected).getTime() === startOfWeekMonday(current).getTime();
  }

  expected.setMonth(previous.getMonth() + 1);
  return expected.getFullYear() === current.getFullYear() && expected.getMonth() === current.getMonth();
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
