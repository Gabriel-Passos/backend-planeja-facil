import { MonthStatus } from '../enums/month-status.enum';

/**
 * Regra centralizada de classificação do preenchimento de um mês.
 *
 * Hoje considera apenas receita (income) e despesa (expense), os dois
 * campos mínimos do planejamento mensal. Se no futuro o planejamento
 * ganhar outros campos obrigatórios, adicione o parâmetro correspondente
 * aqui — este é o ÚNICO lugar que decide o que conta como EMPTY/PARTIAL/
 * COMPLETED, evitando que frontend e backend divirjam sobre a regra.
 */
export function calculateMonthStatus(
  hasIncome: boolean,
  hasExpense: boolean,
): MonthStatus {
  if (hasIncome && hasExpense) {
    return MonthStatus.COMPLETED;
  }

  if (hasIncome || hasExpense) {
    return MonthStatus.PARTIAL;
  }

  return MonthStatus.EMPTY;
}
