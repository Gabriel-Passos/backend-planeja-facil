import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Card, Income, Expense } from '@/src/common/types/prisma';
import { MonthStatus } from './enums/month-status.enum';
import { calculateMonthStatus } from './utils/calculate-month-status.util';
import type { YearMonthsStatusResponse } from './interfaces/year-months-status.interface';

const MONTHS_IN_YEAR = 12;

type CardWithEntries = Card & {
  incomes?: Income[];
  expenses?: Expense[];
};

type GroupTotalsMap = Map<string, number>;

@Injectable()
export class MonthCardsService {
  constructor(private readonly prisma: PrismaService) {}

  // Cards não são mais criados/editados/removidos individualmente — os 12
  // já existem desde a criação do ano (ver YearsService.create). Este
  // service só lê o que já existe.

  async findByYearId(yearId: string) {
    const cards = await this.prisma.card.findMany({
      where: { yearId },
      include: { incomes: true, expenses: true },
      orderBy: { month: 'asc' },
    });

    const { incomeTotals, expenseTotals } = await this.buildGroupTotals(cards);

    return cards.map((card) =>
      this.attachBalance(card, incomeTotals, expenseTotals),
    );
  }

  async findById(yearId: string, cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: { incomes: true, expenses: true },
    });

    if (!card || card.yearId !== yearId) {
      throw new NotFoundException('Card não encontrado.');
    }

    const { incomeTotals, expenseTotals } = await this.buildGroupTotals([card]);

    return this.attachBalance(card, incomeTotals, expenseTotals);
  }

  async getYearMonthsStatus(yearId: string): Promise<YearMonthsStatusResponse> {
    const year = await this.prisma.year.findUnique({
      where: { id: yearId },
    });

    if (!year || year.deletedAt) {
      throw new NotFoundException('Ano não encontrado.');
    }

    // Só o id + as contagens de incomes/expenses — não precisa trazer
    // as listas inteiras, nem title/description, pra montar o grid.
    const cards = await this.prisma.card.findMany({
      where: { yearId },
      select: {
        id: true,
        month: true,
        _count: { select: { incomes: true, expenses: true } },
      },
    });

    const entriesByMonth = new Map<
      number,
      { id: string; status: MonthStatus }
    >();

    for (const card of cards) {
      entriesByMonth.set(card.month, {
        id: card.id,
        status: calculateMonthStatus(
          card._count.incomes > 0,
          card._count.expenses > 0,
        ),
      });
    }

    // Hoje todo ano nasce com os 12 cards já criados, então "id: null"
    // só deveria acontecer em dados antigos (de antes dessa mudança).
    // Mantemos o fallback por segurança, mas na prática não deve ocorrer.
    const months = Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
      const month = index + 1;
      const entry = entriesByMonth.get(month);
      return {
        id: entry?.id ?? null,
        month,
        status: entry?.status ?? MonthStatus.EMPTY,
      };
    });

    return { year: year.year, months };
  }

  async getCardKpis(
    yearId: string,
    cardId: string,
  ): Promise<{ title: string; value: number }[]> {
    // Reaproveita findById — já calcula totalIncome/totalExpense/balance
    // via attachBalance, então não recalcula a mesma coisa duas vezes.
    const card = await this.findById(yearId, cardId);

    return [
      { title: 'Total de receitas', value: card.totalIncome },
      { title: 'Total de despesas', value: card.totalExpense },
      { title: 'Saldo', value: card.balance },
    ];
  }

  // Soma de verdade os valores persistidos de todos os registros que
  // compartilham um groupId (parcelas ou ocorrências recorrentes) —
  // não multiplica valor-da-parcela × quantidade, pra continuar correto
  // mesmo se uma parcela específica for editada individualmente depois.
  // Não é escopado por card/ano: uma parcela pode ter irmãs em outro ano.
  private async buildGroupTotals(cards: CardWithEntries[]): Promise<{
    incomeTotals: GroupTotalsMap;
    expenseTotals: GroupTotalsMap;
  }> {
    const incomeGroupIds = new Set<string>();
    const expenseGroupIds = new Set<string>();

    for (const card of cards) {
      for (const income of card.incomes ?? []) {
        if (income.groupId) incomeGroupIds.add(income.groupId);
      }
      for (const expense of card.expenses ?? []) {
        if (expense.groupId) expenseGroupIds.add(expense.groupId);
      }
    }

    const [incomeAggregates, expenseAggregates] = await Promise.all([
      this.prisma.income.groupBy({
        by: ['groupId'],
        where: { groupId: { in: Array.from(incomeGroupIds) } },
        _sum: { value: true },
      }),
      this.prisma.expense.groupBy({
        by: ['groupId'],
        where: { groupId: { in: Array.from(expenseGroupIds) } },
        _sum: { value: true },
      }),
    ]);

    const incomeTotals: GroupTotalsMap = new Map(
      incomeAggregates
        .filter((a) => a.groupId)
        .map((a) => [a.groupId as string, a._sum.value?.toNumber() ?? 0]),
    );

    const expenseTotals: GroupTotalsMap = new Map(
      expenseAggregates
        .filter((a) => a.groupId)
        .map((a) => [a.groupId as string, a._sum.value?.toNumber() ?? 0]),
    );

    return { incomeTotals, expenseTotals };
  }

  private attachBalance(
    card: CardWithEntries,
    incomeTotals: GroupTotalsMap,
    expenseTotals: GroupTotalsMap,
  ) {
    const incomesWithTotals = (card.incomes ?? []).map((income) => ({
      ...income,
      groupTotalValue: income.groupId
        ? (incomeTotals.get(income.groupId) ?? null)
        : null,
    }));

    const expensesWithTotals = (card.expenses ?? []).map((expense) => ({
      ...expense,
      groupTotalValue: expense.groupId
        ? (expenseTotals.get(expense.groupId) ?? null)
        : null,
    }));

    const totalIncome = incomesWithTotals.reduce(
      (sum, income) => sum + income.value.toNumber(),
      0,
    );
    const totalExpense = expensesWithTotals.reduce(
      (sum, expense) => sum + expense.value.toNumber(),
      0,
    );

    return {
      ...card,
      incomes: incomesWithTotals,
      expenses: expensesWithTotals,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }
}
