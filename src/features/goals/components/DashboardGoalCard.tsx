import { GoalCard } from './GoalCard';
import {
  DashboardPeriod,
  getGoalPeriodFromDashboard,
} from '../utils/goalPeriodUtils';

/**
 * Propriedades recebidas pelo card de meta exibido no Dashboard.
 *
 * selectedPeriod:
 * - período selecionado no Dashboard;
 * - pode ser dia, semana, mês ou ano.
 *
 * selectedDate:
 * - data de referência usada pelo Dashboard;
 * - pode ser Date ou string.
 *
 * currentAmount:
 * - valor atual já alcançado no período;
 * - normalmente representa o faturamento atual do período.
 */
type DashboardGoalCardProps = {
  selectedPeriod: DashboardPeriod;
  selectedDate: Date | string;
  currentAmount: number;
};

/**
 * Card de meta usado dentro do Dashboard.
 *
 * Esse componente funciona como uma ponte entre:
 * - o período selecionado no Dashboard;
 * - o componente genérico GoalCard.
 *
 * Ele recebe o período atual do Dashboard e converte para o formato
 * que o GoalCard precisa entender.
 */
export function DashboardGoalCard({
  selectedPeriod,
  selectedDate,
  currentAmount,
}: DashboardGoalCardProps) {
  /**
   * Converte o período do Dashboard para os dados da meta.
   *
   * Exemplo:
   * - se o Dashboard estiver em "day", gera a meta daquele dia;
   * - se estiver em "week", gera a meta daquela semana;
   * - se estiver em "month", gera a meta daquele mês;
   * - se estiver em "year", gera a meta daquele ano.
   *
   * O retorno normalmente contém:
   * - periodType: tipo do período da meta;
   * - periodKey: chave única do período;
   * - periodStart: data inicial do período;
   * - periodEnd: data final do período.
   */
  const goalPeriod = getGoalPeriodFromDashboard(
    selectedPeriod,
    selectedDate,
  );

  /**
   * Renderiza o GoalCard com os dados já convertidos.
   *
   * Assim, o GoalCard não precisa saber diretamente como o Dashboard
   * organiza seus períodos.
   */
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
