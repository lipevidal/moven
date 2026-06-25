import { GoalCard } from './GoalCard';
import {
  DashboardPeriod,
  getGoalPeriodFromDashboard,
} from '../utils/goalPeriodUtils';

type DashboardGoalCardProps = {
  selectedPeriod: DashboardPeriod;
  selectedDate: Date | string;
  currentAmount: number;
};

export function DashboardGoalCard({
  selectedPeriod,
  selectedDate,
  currentAmount,
}: DashboardGoalCardProps) {
  const goalPeriod = getGoalPeriodFromDashboard(
    selectedPeriod,
    selectedDate,
  );

  return (
    <GoalCard
      periodType={goalPeriod.periodType}
      periodKey={goalPeriod.periodKey}
      periodStart={goalPeriod.periodStart}
      periodEnd={goalPeriod.periodEnd}
      currentAmount={currentAmount}
    />
  );
}
