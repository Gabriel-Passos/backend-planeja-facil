import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { IncomesService } from './incomes.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { BulkEntryIdsDto } from '../dto/bulk-entry-ids.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { YearRolesGuard } from '@/src/common/guards/year-roles.guard';
import { YearRoles } from '@/src/common/decorators/year-roles.decorator';
import { YearRole } from '@/src/common/types/prisma';

@ApiTags('Incomes')
@ApiBearerAuth()
@ApiParam({ name: 'yearId', description: 'ID do ano' })
@ApiParam({ name: 'cardId', description: 'ID do card' })
@UseGuards(JwtAuthGuard, YearRolesGuard)
@Controller('years/:yearId/month-cards/:cardId/incomes')
export class IncomesController {
  constructor(private readonly incomesService: IncomesService) {}

  @Post()
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  @ApiOperation({ summary: 'Adiciona uma renda a um card existente' })
  create(
    @Param('yearId') yearId: string,
    @Param('cardId') cardId: string,
    @Body() dto: CreateIncomeDto,
  ) {
    return this.incomesService.create(yearId, cardId, dto);
  }

  @Post('bulk-remove')
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  @ApiOperation({ summary: 'Remove várias rendas de uma vez' })
  removeMany(
    @Param('yearId') yearId: string,
    @Param('cardId') cardId: string,
    @Body() dto: BulkEntryIdsDto,
  ) {
    return this.incomesService.removeMany(yearId, cardId, dto.ids);
  }

  @Patch(':incomeId')
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  @ApiOperation({ summary: 'Atualiza uma renda específica' })
  @ApiParam({ name: 'incomeId', description: 'ID da renda' })
  update(
    @Param('yearId') yearId: string,
    @Param('cardId') cardId: string,
    @Param('incomeId') incomeId: string,
    @Body() dto: UpdateIncomeDto,
  ) {
    return this.incomesService.update(yearId, cardId, incomeId, dto);
  }

  @Delete(':incomeId')
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  @ApiOperation({
    summary:
      'Remove uma renda específica — se for parcela/recorrência, remove o grupo inteiro',
  })
  @ApiParam({ name: 'incomeId', description: 'ID da renda' })
  remove(
    @Param('yearId') yearId: string,
    @Param('cardId') cardId: string,
    @Param('incomeId') incomeId: string,
  ) {
    return this.incomesService.remove(yearId, cardId, incomeId);
  }
}
