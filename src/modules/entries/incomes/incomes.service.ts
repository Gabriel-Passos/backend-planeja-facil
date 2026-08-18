import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import type { Card, Income, Year } from '@/src/common/types/prisma';
import { RecurrenceType } from '@/src/common/types/prisma';
import { resolveRecurrenceFields } from '@/src/common/utils/recurrence.util';
import { validateEntryDateWithinCardMonth } from '@/src/common/utils/validate-entry-date.util';
import { shiftDateToTargetMonth } from '@/src/common/utils/shift-date.util';
import { EntryPropagationService } from '../entry-propagation.service';
import type { BulkOperationResult } from '@/src/common/interfaces/bulk-operation-result.interface';

type CardWithYear = Card & { year: Year };

// Recorrência sem data de término definida gera 24 meses inicialmente
// (ver spec) — 2 anos, contando o próprio mês de origem.
const RECURRING_DEFAULT_OCCURRENCES = 24;

@Injectable()
export class IncomesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propagationService: EntryPropagationService,
  ) {}

  async create(
    yearId: string,
    cardId: string,
    dto: CreateIncomeDto,
  ): Promise<Income> {
    const card = await this.getActiveCardOrThrow(yearId, cardId);

    const date = new Date(dto.date);
    validateEntryDateWithinCardMonth(date, card.month, card.year.year);

    const recurrenceFields = resolveRecurrenceFields(dto);

    // Lançamento avulso: sem propagação, fluxo direto de sempre.
    if (recurrenceFields.recurrenceType === RecurrenceType.NONE) {
      return this.prisma.income.create({
        data: {
          description: dto.description,
          type: dto.type,
          value: dto.value as number,
          date,
          cardId,
          ...recurrenceFields,
        },
      });
    }

    const occurrenceCount =
      recurrenceFields.recurrenceType === RecurrenceType.INSTALLMENT
        ? (dto.qtdInstallments as number)
        : RECURRING_DEFAULT_OCCURRENCES;

    // Parcelado usa installmentValue (valor de CADA parcela);
    // recorrente continua usando value (mesmo valor em toda ocorrência).
    const occurrenceValue =
      recurrenceFields.recurrenceType === RecurrenceType.INSTALLMENT
        ? (dto.installmentValue as number)
        : (dto.value as number);

    // Tudo dentro de uma única transação: criar ano(s)/card(s) que
    // faltarem + todas as N ocorrências. Ou tudo é criado, ou nada é.
    return this.prisma.$transaction(async (tx) => {
      const targetCards = await this.propagationService.resolveTargetCards(
        tx,
        card,
        occurrenceCount,
      );

      const createdIncomes: Income[] = [];

      for (const [index, targetCard] of targetCards.entries()) {
        const occurrenceDate = shiftDateToTargetMonth(
          date,
          targetCard.month,
          targetCard.year,
        );

        const income = await tx.income.create({
          data: {
            description: dto.description,
            type: dto.type,
            value: occurrenceValue,
            date: occurrenceDate,
            cardId: targetCard.id,
            recurrenceType: recurrenceFields.recurrenceType,
            groupId: recurrenceFields.groupId,
            installmentNumber:
              recurrenceFields.recurrenceType === RecurrenceType.INSTALLMENT
                ? index + 1
                : null,
            totalInstallments:
              recurrenceFields.recurrenceType === RecurrenceType.INSTALLMENT
                ? occurrenceCount
                : null,
          },
        });

        createdIncomes.push(income);
      }

      // Devolve o registro criado no card de origem (índice 0) — é o
      // que o cliente estava esperando ao chamar esse endpoint.
      return createdIncomes[0];
    });
  }

  async update(
    yearId: string,
    cardId: string,
    incomeId: string,
    dto: UpdateIncomeDto,
  ): Promise<Income> {
    const card = await this.getActiveCardOrThrow(yearId, cardId);
    const income = await this.getIncomeOrThrow(cardId, incomeId);

    const sharedData: Record<string, unknown> = {};
    if (dto.description !== undefined) sharedData.description = dto.description;
    if (dto.type !== undefined) sharedData.type = dto.type;
    if (dto.value !== undefined) sharedData.value = dto.value;

    let ownDate: Date | undefined;
    if (dto.date !== undefined) {
      ownDate = new Date(dto.date);
      validateEntryDateWithinCardMonth(ownDate, card.month, card.year.year);
    }

    const recurrenceOverride =
      dto.recurrent !== undefined ||
      dto.inInstallments !== undefined ||
      dto.qtdInstallments !== undefined
        ? resolveRecurrenceFields(dto)
        : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (income.groupId && Object.keys(sharedData).length > 0) {
        await tx.income.updateMany({
          where: { groupId: income.groupId },
          data: sharedData,
        });
      }

      return tx.income.update({
        where: { id: incomeId },
        data: {
          ...(income.groupId ? {} : sharedData),
          ...(ownDate ? { date: ownDate } : {}),
          ...(recurrenceOverride ?? {}),
        },
      });
    });
  }

  async remove(
    yearId: string,
    cardId: string,
    incomeId: string,
  ): Promise<{ removedCount: number }> {
    await this.getActiveCardOrThrow(yearId, cardId);
    const income = await this.getIncomeOrThrow(cardId, incomeId);

    if (income.groupId) {
      const result = await this.prisma.income.deleteMany({
        where: { groupId: income.groupId },
      });
      return { removedCount: result.count };
    }

    await this.prisma.income.delete({ where: { id: incomeId } });
    return { removedCount: 1 };
  }

  async removeMany(
    yearId: string,
    cardId: string,
    ids: string[],
  ): Promise<BulkOperationResult> {
    await this.getActiveCardOrThrow(yearId, cardId);

    const succeeded: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const id of ids) {
      try {
        await this.getIncomeOrThrow(cardId, id);
        await this.prisma.income.delete({ where: { id } });
        succeeded.push(id);
      } catch (error) {
        failed.push({
          id,
          reason: error instanceof Error ? error.message : 'Erro desconhecido.',
        });
      }
    }

    return { succeeded, failed };
  }

  private async getActiveCardOrThrow(
    yearId: string,
    cardId: string,
  ): Promise<CardWithYear> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: { year: true },
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
