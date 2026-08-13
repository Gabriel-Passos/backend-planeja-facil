import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class BulkYearIdsDto {
  @ApiProperty({
    type: [String],
    description: 'IDs dos anos a processar (1 a 50 por vez)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  yearIds!: string[];
}
