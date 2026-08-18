import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { RecurrenceType } from '../types/prisma';

interface RecurrenceInput {
  recurrent?: boolean;
  inInstallments?: boolean;
  qtdInstallments?: number;
}

interface RecurrenceFields {
  recurrenceType: RecurrenceType;
  groupId: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
}

/**
 * Traduz os campos "de fora" (recurrent/inInstallments/qtdInstallments,
 * como a API recebe) pros campos reais do schema (recurrenceType/groupId/
 * installmentNumber/totalInstallments). Usado tanto por Income quanto
 * por Expense — mesma regra pros dois.
 *
 * Fase 2: só resolve os campos do PRIMEIRO registro (groupId novo,
 * installmentNumber = 1). A geração das parcelas/ocorrências seguintes
 * nos outros meses é responsabilidade da Fase 3.
 */
export function resolveRecurrenceFields(
  input: RecurrenceInput,
): RecurrenceFields {
  if (input.recurrent && input.inInstallments) {
    throw new BadRequestException(
      'Um lançamento não pode ser recorrente e parcelado ao mesmo tempo.',
    );
  }

  if (input.inInstallments) {
    return {
      recurrenceType: RecurrenceType.INSTALLMENT,
      groupId: randomUUID(),
      installmentNumber: 1,
      totalInstallments: input.qtdInstallments ?? null,
    };
  }

  if (input.recurrent) {
    return {
      recurrenceType: RecurrenceType.RECURRING,
      groupId: randomUUID(),
      installmentNumber: null,
      totalInstallments: null,
    };
  }

  return {
    recurrenceType: RecurrenceType.NONE,
    groupId: null,
    installmentNumber: null,
    totalInstallments: null,
  };
}
