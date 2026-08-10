import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ExpenseCategory } from '@/src/common/types/prisma';

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number; // se não vier, o Prisma aplica o default 1
}
