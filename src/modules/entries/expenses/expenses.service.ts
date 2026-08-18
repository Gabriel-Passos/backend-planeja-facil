import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import type { Card, Expense, Year } from '@/src/common/types/prisma';
import { RecurrenceType } from '@/src/common/types/prisma';
import { resolveRecurrenceFields } from '@/src/common/utils/recurrence.util';
import { validateEntryDateWithinCardMonth } from '@/src/common/utils/validate-entry-date.util';
import { shiftDateToTargetMonth } from '@/src/common/utils/shift-date.util';
import { EntryPropagationService } from '../entry-propagation.service';
import type { BulkOperationResult } from '@/src/common/interfaces/bulk-operation-result.interface';

type CardWithYear = Card & { year: Year };

const RECURRING_DEFAULT_OCCURRENCES = 24;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propagationService: EntryPropagationService,
  ) {}

  async create(
    yearId: string,
    cardId: string,
    dto: CreateExpenseDto,
  ): Promise<Expense> {
    const card = await this.getActiveCardOrThrow(yearId, cardId);

    const date = new Date(dto.date);
    validateEntryDateWithinCardMonth(date, card.month, card.year.year);

    const recurrenceFields = resolveRecurrenceFields(dto);

    if (recurrenceFields.recurrenceType === RecurrenceType.NONE) {
      return this.prisma.expense.create({
        data: {
          name: dto.name,
          category: dto.category,
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

    return this.prisma.$transaction(async (tx) => {
      const targetCards = await this.propagationService.resolveTargetCards(
        tx,
        card,
        occurrenceCount,
      );

      const createdExpenses: Expense[] = [];

      for (const [index, targetCard] of targetCards.entries()) {
        const occurrenceDate = shiftDateToTargetMonth(
          date,
          targetCard.month,
          targetCard.year,
        );

        const expense = await tx.expense.create({
          data: {
            name: dto.name,
            category: dto.category,
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

        createdExpenses.push(expense);
      }

      return createdExpenses[0];
    });
  }

  async update(
    yearId: string,
    cardId: string,
    expenseId: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    const card = await this.getActiveCardOrThrow(yearId, cardId);
    const expense = await this.getExpenseOrThrow(cardId, expenseId);

    // Campos "descritivos" — propagam pra todo o grupo quando existir.
    const sharedData: Record<string, unknown> = {};
    if (dto.name !== undefined) sharedData.name = dto.name;
    if (dto.category !== undefined) sharedData.category = dto.category;
    if (dto.value !== undefined) sharedData.value = dto.value;

    // date é específico de cada ocorrência — NUNCA propaga pro grupo.
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
      if (expense.groupId && Object.keys(sharedData).length > 0) {
        // Propaga os campos descritivos pra TODAS as parcelas/ocorrências
        // do grupo (passadas e futuras) — inclusive esse próprio registro.
        await tx.expense.updateMany({
          where: { groupId: expense.groupId },
          data: sharedData,
        });
      }

      return tx.expense.update({
        where: { id: expenseId },
        data: {
          // Se não tem grupo, os campos descritivos ainda não foram
          // aplicados (não caiu no updateMany acima) — aplica aqui.
          ...(expense.groupId ? {} : sharedData),
          ...(ownDate ? { date: ownDate } : {}),
          ...(recurrenceOverride ?? {}),
        },
      });
    });
  }

  async remove(
    yearId: string,
    cardId: string,
    expenseId: string,
  ): Promise<{ removedCount: number }> {
    await this.getActiveCardOrThrow(yearId, cardId);
    const expense = await this.getExpenseOrThrow(cardId, expenseId);

    // Faz parte de um grupo (parcela/recorrência) — remove TODAS as
    // ocorrências do grupo, não só essa. Sem escopo de card/ano, já que
    // o grupo pode cruzar vários.
    if (expense.groupId) {
      const result = await this.prisma.expense.deleteMany({
        where: { groupId: expense.groupId },
      });
      return { removedCount: result.count };
    }

    await this.prisma.expense.delete({ where: { id: expenseId } });
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
        await this.getExpenseOrThrow(cardId, id);
        await this.prisma.expense.delete({ where: { id } });
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
