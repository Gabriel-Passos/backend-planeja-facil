import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { IncomeType } from '@/src/common/types/prisma';

export class CreateIncomeDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsEnum(IncomeType)
  type?: IncomeType; // se não vier, o Prisma aplica o default SALARIO

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value!: number;
}
