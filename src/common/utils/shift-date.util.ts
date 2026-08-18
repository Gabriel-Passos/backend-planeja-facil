/**
 * Move a data original pro mesmo dia-do-mês, mas no mês/ano de destino.
 * Se o dia não existir no mês de destino (ex: dia 31 num mês de 30 dias),
 * usa o último dia válido daquele mês.
 */
export function shiftDateToTargetMonth(
  originalDate: Date,
  targetMonth: number,
  targetYear: number,
): Date {
  const day = originalDate.getUTCDate();
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth, 0),
  ).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth - 1, clampedDay));
}
