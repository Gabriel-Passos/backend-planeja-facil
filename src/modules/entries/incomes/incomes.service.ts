import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import type { Card, Income } from '@/src/common/types/prisma';
import { UpdateIncomeDto } from './dto/update-income.dto';

@Injectable()
export class IncomesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    yearId: string,
    cardId: string,
    dto: CreateIncomeDto,
  ): Promise<Income> {
    await this.getActiveCardOrThrow(yearId, cardId);

    return this.prisma.income.create({
      data: { ...dto, cardId },
    });
  }

  async update(
    yearId: string,
    cardId: string,
    incomeId: string,
    dto: UpdateIncomeDto,
  ): Promise<Income> {
    await this.getActiveCardOrThrow(yearId, cardId);
    await this.getIncomeOrThrow(cardId, incomeId);

    return this.prisma.income.update({
      where: { id: incomeId },
      data: dto,
    });
  }

  async remove(
    yearId: string,
    cardId: string,
    incomeId: string,
  ): Promise<void> {
    await this.getActiveCardOrThrow(yearId, cardId);
    await this.getIncomeOrThrow(cardId, incomeId);

    await this.prisma.income.delete({ where: { id: incomeId } });
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

  private async getIncomeOrThrow(
    cardId: string,
    incomeId: string,
  ): Promise<Income> {
    const income = await this.prisma.income.findUnique({
      where: { id: incomeId },
    });

    if (!income || income.cardId !== cardId) {
      throw new NotFoundException('Renda não encontrada.');
    }

    return income;
  }
}
