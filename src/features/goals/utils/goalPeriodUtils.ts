export type GoalPeriodType = 'day' | 'week' | 'month' | 'year';

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

export type GoalPeriodInfo = {
  periodType: GoalPeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
};

export function normalizeGoalPeriod(period: DashboardPeriod): GoalPeriodType {
  if (period === 'dia') return 'day';
  if (period === 'semana') return 'week';
  if (period === 'mes' || period === 'mês') return 'month';
  if (period === 'ano') return 'year';

  return period;
}

export function getGoalPeriodFromDashboard(
  selectedPeriod: DashboardPeriod,
  selectedDate: Date | string = new Date(),
): GoalPeriodInfo {
  const periodType = normalizeGoalPeriod(selectedPeriod);
  const baseDate = new Date(selectedDate);

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
