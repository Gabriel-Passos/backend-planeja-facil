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
import { IncomeType } from '@/src/common/types/prisma';

export class CreateIncomeDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsEnum(IncomeType)
  type?: IncomeType; // se não vier, o Prisma aplica o default SALARIO

  @ValidateIf((dto: CreateIncomeDto) => !dto.inInstallments)
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

  @ValidateIf((dto: CreateIncomeDto) => dto.inInstallments === true)
  @IsInt()
  @Min(1)
  qtdInstallments?: number;

  @ValidateIf((dto: CreateIncomeDto) => dto.inInstallments === true)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  installmentValue?: number;
}
