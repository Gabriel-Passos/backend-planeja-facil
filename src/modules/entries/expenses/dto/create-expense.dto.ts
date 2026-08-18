import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ExpenseCategory } from '@/src/common/types/prisma';

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  // Obrigatório pra lançamento único/recorrente. Pra parcelado, usa
  // installmentValue no lugar (ver abaixo) — não faz sentido preencher
  // os dois ao mesmo tempo.
  @ValidateIf((dto: CreateExpenseDto) => !dto.inInstallments)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value?: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsBoolean()
  recurrent?: boolean;

  @IsOptional()
  @IsBoolean()
  inInstallments?: boolean;

  // Obrigatório (e só faz sentido) quando inInstallments = true.
  @ValidateIf((dto: CreateExpenseDto) => dto.inInstallments === true)
  @IsInt()
  @Min(1)
  qtdInstallments?: number;

  // Valor de CADA parcela — o backend soma pra saber o total.
  @ValidateIf((dto: CreateExpenseDto) => dto.inInstallments === true)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  installmentValue?: number;
}
