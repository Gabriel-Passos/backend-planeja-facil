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
    return cards.map((card) => this.attachBalance(card));
  }

  async findById(yearId: string, cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: { incomes: true, expenses: true },
    });

    if (!card || card.yearId !== yearId) {
      throw new NotFoundException('Card não encontrado.');
    }

    return this.attachBalance(card);
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

  private attachBalance(card: CardWithEntries) {
    const totalIncome = (card.incomes ?? []).reduce(
      (sum, income) => sum + income.value.toNumber(),
      0,
    );
    const totalExpense = (card.expenses ?? []).reduce(
      (sum, expense) => sum + expense.value.toNumber(),
      0,
    );

    return {
      ...card,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }
}
