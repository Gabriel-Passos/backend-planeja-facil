import { Injectable } from '@nestjs/common';
import type { Card, Prisma, Year } from '@/src/common/types/prisma';
import { YearRole } from '@/src/common/types/prisma';
import { MONTH_NAMES } from '@/src/common/constants/month-names.constant';

type TransactionClient = Prisma.TransactionClient;

export interface TargetCard {
  id: string;
  month: number;
  year: number;
}

@Injectable()
export class EntryPropagationService {
  /**
   * A partir do card de origem, resolve os N cards de destino da operação
   * (o próprio card de origem no índice 0, seguido dos meses seguintes).
   * Cria anos + os 12 cards automaticamente quando o ano de destino ainda
   * não existir. PRECISA rodar dentro de uma transação (tx) — quem chama
   * é responsável por isso, já que essa operação cria registros em várias
   * tabelas que precisam ser tudo-ou-nada.
   */
  async resolveTargetCards(
    tx: TransactionClient,
    originCard: Card & { year: Year },
    occurrenceCount: number,
  ): Promise<TargetCard[]> {
    const targets = this.buildTargetMonths(originCard, occurrenceCount);
    const distinctYears = Array.from(new Set(targets.map((t) => t.year)));

    // yearNumber -> (month -> cardId)
    const yearCardsMap = new Map<number, Map<number, string>>();

    for (const yearNumber of distinctYears) {
      const cardsByMonth = await this.getOrCreateYearCards(
        tx,
        originCard.year.creatorId,
        yearNumber,
      );
      yearCardsMap.set(yearNumber, cardsByMonth);
    }

    return targets.map(({ month, year }) => {
      const isOriginMonth =
        year === originCard.year.year && month === originCard.month;

      const cardId = isOriginMonth
        ? originCard.id
        : yearCardsMap.get(year)?.get(month);

      if (!cardId) {
        // Não deveria acontecer — se acontecer, é bug na resolução acima,
        // não erro de usuário. Melhor falhar alto a criar dado incompleto.
        throw new Error(
          `Não foi possível localizar/criar o card de ${month}/${year}.`,
        );
      }

      return { id: cardId, month, year };
    });
  }

  private buildTargetMonths(
    originCard: Card & { year: Year },
    occurrenceCount: number,
  ): { month: number; year: number }[] {
    const targets: { month: number; year: number }[] = [];

    for (let i = 0; i < occurrenceCount; i++) {
      const zeroBasedMonth = originCard.month - 1 + i;
      const month = (zeroBasedMonth % 12) + 1;
      const year = originCard.year.year + Math.floor(zeroBasedMonth / 12);
      targets.push({ month, year });
    }

    return targets;
  }

  private async getOrCreateYearCards(
    tx: TransactionClient,
    creatorId: string,
    yearNumber: number,
  ): Promise<Map<number, string>> {
    let year = await tx.year.findUnique({
      where: { creatorId_year: { creatorId, year: yearNumber } },
      include: { cards: true },
    });

    if (!year) {
      const createdYear = await tx.year.create({
        data: { year: yearNumber, creatorId },
      });

      await tx.yearMember.create({
        data: {
          yearId: createdYear.id,
          userId: creatorId,
          role: YearRole.ADMIN,
          acceptedAt: new Date(),
        },
      });

      await tx.card.createMany({
        data: MONTH_NAMES.map((name, index) => ({
          title: name,
          month: index + 1,
          yearId: createdYear.id,
          createdById: creatorId,
        })),
      });

      year = await tx.year.findUnique({
        where: { id: createdYear.id },
        include: { cards: true },
      });
    }

    const cardsByMonth = new Map<number, string>();
    for (const card of year!.cards) {
      cardsByMonth.set(card.month, card.id);
    }

    return cardsByMonth;
  }
}
