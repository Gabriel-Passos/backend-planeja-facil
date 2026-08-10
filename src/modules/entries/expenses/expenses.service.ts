import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import type { Card, Expense } from '@/src/common/types/prisma';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    yearId: string,
    cardId: string,
    dto: CreateExpenseDto,
  ): Promise<Expense> {
    await this.getActiveCardOrThrow(yearId, cardId);

    return this.prisma.expense.create({
      data: { ...dto, cardId },
    });
  }

  async update(
    yearId: string,
    cardId: string,
    expenseId: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    await this.getActiveCardOrThrow(yearId, cardId);
    await this.getExpenseOrThrow(cardId, expenseId);

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: dto,
    });
  }

  async remove(
    yearId: string,
    cardId: string,
    expenseId: string,
  ): Promise<void> {
    await this.getActiveCardOrThrow(yearId, cardId);
    await this.getExpenseOrThrow(cardId, expenseId);

    await this.prisma.expense.delete({ where: { id: expenseId } });
  }

  private async getActiveCardOrThrow(
    yearId: string,
    cardId: string,
  ): Promise<Card> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card || card.yearId !== yearId || card.deletedAt) {
      throw new NotFoundException('Card não encontrado.');
    }

    return card;
  }

  private async getExpenseOrThrow(
    cardId: string,
    expenseId: string,
  ): Promise<Expense> {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense || expense.cardId !== cardId) {
      throw new NotFoundException('Despesa não encontrada.');
    }

    return expense;
  }
}
