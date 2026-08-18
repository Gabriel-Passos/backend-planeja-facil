import { BadRequestException } from '@nestjs/common';

export function validateEntryDateWithinCardMonth(
  date: Date,
  cardMonth: number,
  yearNumber: number,
): void {
  const dateMonth = date.getUTCMonth() + 1;
  const dateYear = date.getUTCFullYear();

  if (dateMonth !== cardMonth || dateYear !== yearNumber) {
    const monthLabel = String(cardMonth).padStart(2, '0');
    throw new BadRequestException(
      `A data do lançamento precisa estar dentro de ${monthLabel}/${yearNumber}.`,
    );
  }
}
