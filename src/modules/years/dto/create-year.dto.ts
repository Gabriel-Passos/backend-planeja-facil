import { IsInt, Max, Min } from 'class-validator';

export class CreateYearDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}
