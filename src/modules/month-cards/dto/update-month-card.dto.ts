import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateMonthCardDto } from './create-month-card.dto';

// Omit incomes/expenses: edição de itens individuais é responsabilidade
// de endpoints próprios (POST/PATCH/DELETE em /month-cards/:id/expenses etc.),
// não desse PATCH geral do card.
export class UpdateMonthCardDto extends PartialType(
  OmitType(CreateMonthCardDto, ['incomes', 'expenses'] as const),
) {}
