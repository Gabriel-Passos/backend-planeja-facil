import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MonthCardsService } from './month-cards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { YearRolesGuard } from '@/src/common/guards/year-roles.guard';

@ApiTags('Month Cards') // agrupa essas rotas sob "Month Cards" na sidebar do Swagger
@ApiBearerAuth() // aplica o cadeado (autenticação) a TODAS as rotas do controller
@ApiParam({ name: 'yearId', description: 'ID do ano ao qual o card pertence' })
@UseGuards(JwtAuthGuard, YearRolesGuard)
@Controller('years/:yearId/month-cards')
export class MonthCardsController {
  constructor(private readonly monthCardsService: MonthCardsService) {}

  // Qualquer papel do ano pode visualizar. Os 12 cards já existem desde
  // a criação do ano — não há mais criação/edição/remoção individual.
  @Get()
  @ApiOperation({ summary: 'Lista os 12 cards (meses) do ano' })
  @ApiResponse({ status: 200, description: 'Lista dos 12 cards do ano.' })
  findByYearId(@Param('yearId') yearId: string) {
    return this.monthCardsService.findByYearId(yearId);
  }

  // Precisa vir ANTES de ':cardId' pra não ser interpretado como um id
  @Get('status')
  @ApiOperation({
    summary: 'Status de preenchimento de cada mês do ano',
    description:
      'Retorna EMPTY/PARTIAL/COMPLETED por mês, calculado a partir de receitas e despesas preenchidas.',
  })
  getMonthsStatus(@Param('yearId') yearId: string) {
    return this.monthCardsService.getYearMonthsStatus(yearId);
  }

  @Get(':cardId')
  @ApiOperation({ summary: 'Busca o card de um mês específico pelo id' })
  @ApiParam({ name: 'cardId', description: 'ID do card' })
  @ApiResponse({ status: 404, description: 'Card não encontrado.' })
  findById(@Param('yearId') yearId: string, @Param('cardId') cardId: string) {
    return this.monthCardsService.findById(yearId, cardId);
  }
}
