import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { YearRolesGuard } from '@/src/common/guards/year-roles.guard';
import { YearRoles } from '@/src/common/decorators/year-roles.decorator';
import { YearRole } from '@/src/common/types/prisma';

@ApiTags('Expenses')
@ApiBearerAuth()
@ApiParam({ name: 'yearId', description: 'ID do ano' })
@ApiParam({ name: 'cardId', description: 'ID do card' })
@UseGuards(JwtAuthGuard, YearRolesGuard)
@Controller('years/:yearId/month-cards/:cardId/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  @ApiOperation({ summary: 'Adiciona uma despesa a um card existente' })
  create(
    @Param('yearId') yearId: string,
    @Param('cardId') cardId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(yearId, cardId, dto);
  }

  @Patch(':expenseId')
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  @ApiOperation({ summary: 'Atualiza uma despesa específica' })
  @ApiParam({ name: 'expenseId', description: 'ID da despesa' })
  update(
    @Param('yearId') yearId: string,
    @Param('cardId') cardId: string,
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(yearId, cardId, expenseId, dto);
  }

  @Delete(':expenseId')
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma despesa específica' })
  @ApiParam({ name: 'expenseId', description: 'ID da despesa' })
  remove(
    @Param('yearId') yearId: string,
    @Param('cardId') cardId: string,
    @Param('expenseId') expenseId: string,
  ) {
    return this.expensesService.remove(yearId, cardId, expenseId);
  }
}
