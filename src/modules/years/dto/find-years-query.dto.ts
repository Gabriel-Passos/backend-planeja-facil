import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsInt, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@/src/common/dto/pagination-query.dto';

export class FindYearsQueryDto extends PaginationQueryDto {
  // Cobre tanto busca por um único ano ("2025") quanto por vários
  // ("2020,2022,2025") — é o mesmo parâmetro pros dois casos, viram
  // uma condição IN no banco de qualquer forma.
  @ApiPropertyOptional({
    description:
      'Um ou mais anos, separados por vírgula (ex: "2025" ou "2020,2022,2025")',
    example: '2020,2022,2025',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => Number(item))
        .filter((item) => !Number.isNaN(item));
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => !Number.isNaN(item));
    }

    return undefined;
  })
  @IsArray()
  @IsInt({ each: true })
  years?: number[];
}
