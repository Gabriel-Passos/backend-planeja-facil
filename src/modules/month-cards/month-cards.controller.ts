import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MonthCardsService } from './month-cards.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateMonthCardDto } from './dto/create-month-card.dto';
import { UpdateMonthCardDto } from './dto/update-month-card.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { YearRolesGuard } from '@/src/common/guards/year-roles.guard';
import { YearRoles } from '@/src/common/decorators/year-roles.decorator';
import { YearRole } from '@/src/common/types/prisma';

@UseGuards(JwtAuthGuard, YearRolesGuard)
@Controller('years/:yearId/month-cards')
export class MonthCardsController {
  constructor(private readonly monthCardsService: MonthCardsService) {}

  @Post()
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMonthCardDto,
    @Param('yearId') yearId: string,
  ) {
    return this.monthCardsService.create(user.id, dto, yearId);
  }

  // Qualquer papel do ano pode visualizar
  @Get()
  findByYearId(@Param('yearId') yearId: string) {
    return this.monthCardsService.findByYearId(yearId);
  }

  // Precisa vir ANTES de ':cardId' pra não ser interpretado como um id
  @Get('deleted')
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  findDeletedByYearId(@Param('yearId') yearId: string) {
    return this.monthCardsService.findDeletedByYearId(yearId);
  }

  @Get(':cardId')
  findById(@Param('yearId') yearId: string, @Param('cardId') cardId: string) {
    return this.monthCardsService.findById(yearId, cardId);
  }

  @Patch(':cardId')
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  update(
    @Param('yearId') yearId: string,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateMonthCardDto,
  ) {
    return this.monthCardsService.update(yearId, cardId, dto);
  }

  @Delete(':cardId')
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('yearId') yearId: string, @Param('cardId') cardId: string) {
    return this.monthCardsService.delete(yearId, cardId);
  }

  @Post(':cardId/restore')
  @YearRoles(YearRole.ADMIN, YearRole.EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  restore(@Param('yearId') yearId: string, @Param('cardId') cardId: string) {
    return this.monthCardsService.restore(yearId, cardId);
  }
}
