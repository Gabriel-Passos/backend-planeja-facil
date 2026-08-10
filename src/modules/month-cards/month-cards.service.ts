import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonthCardDto } from './dto/create-month-card.dto';
import { UpdateMonthCardDto } from './dto/update-month-card.dto';
import type { Card, Income, Expense } from '@/src/common/types/prisma';

const MAX_CARDS_PER_YEAR = 12;

type CardWithEntries = Card & {
  incomes?: Income[];
  expenses?: Expense[];
};

@Injectable()
export class MonthCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMonthCardDto, yearId: string) {
    const existingCard = await this.prisma.card.findUnique({
      where: { yearId_month: { yearId, month: dto.month } },
    });

    if (existingCard) {
      if (existingCard.deletedAt) {
        throw new ConflictException(
          'Já existe um card excluído para esse mês. Restaure-o em vez de criar um novo.',
        );
      }
      throw new ConflictException('Já existe um card para esse mês.');
    }

    const card = await this.prisma.card.create({
      data: {
        title: dto.title,
        description: dto.description,
        month: dto.month,
        yearId,
        createdById: userId,
        incomes: dto.incomes?.length
          ? { create: dto.incomes.map((income) => ({ ...income })) }
          : undefined,
        expenses: dto.expenses?.length
          ? { create: dto.expenses.map((expense) => ({ ...expense })) }
          : undefined,
      },
      include: { incomes: true, expenses: true },
    });

    return this.attachBalance(card);
  }

  async findDeletedByYearId(yearId: string) {
    const cards = await this.prisma.card.findMany({
      where: { yearId, deletedAt: { not: null } },
      orderBy: { month: 'asc' },
    });
    return cards;
  }

  async findById(yearId: string, cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: { incomes: true, expenses: true },
    });

    if (!card || card.yearId !== yearId || card.deletedAt) {
      throw new NotFoundException('Card não encontrado.');
    }

    return this.attachBalance(card);
  }

  async findByYearId(yearId: string) {
    const cards = await this.prisma.card.findMany({
      where: { yearId, deletedAt: null },
      include: { incomes: true, expenses: true },
      orderBy: { month: 'asc' },
    });
    return cards.map((card) => this.attachBalance(card));
  }

  async delete(yearId: string, cardId: string): Promise<void> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card || card.yearId !== yearId || card.deletedAt) {
      throw new NotFoundException('Card não encontrado.');
    }

    await this.prisma.card.update({
      where: { id: cardId },
      data: { deletedAt: new Date() },
    });
  }

  async restore(yearId: string, cardId: string): Promise<void> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card || card.yearId !== yearId || !card.deletedAt) {
      throw new NotFoundException('Card não encontrado ou não está excluído.');
    }

    const activeCount = await this.prisma.card.count({
      where: { yearId, deletedAt: null },
    });

    if (activeCount >= MAX_CARDS_PER_YEAR) {
      throw new ConflictException(
        'Este ano já atingiu o limite de 12 cards ativos. Remova ou restaure outro antes.',
      );
    }

    await this.prisma.card.update({
      where: { id: cardId },
      data: { deletedAt: null },
    });
  }

  async update(yearId: string, cardId: string, dto: UpdateMonthCardDto) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card || card.yearId !== yearId || card.deletedAt) {
      throw new NotFoundException('Card não encontrado.');
    }

    if (dto.month !== undefined) {
      const conflict = await this.prisma.card.findUnique({
        where: { yearId_month: { yearId, month: dto.month } },
      });

      if (conflict && conflict.id !== cardId) {
        throw new ConflictException('Já existe um card para esse mês.');
      }
    }

    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: dto,
      include: { incomes: true, expenses: true },
    });

    return this.attachBalance(updated);
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
