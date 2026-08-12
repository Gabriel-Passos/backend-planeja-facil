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
  Query,
  UseGuards,
} from '@nestjs/common';
import { YearsService } from './years.service';
import { CreateYearDto } from './dto/create-year.dto';
import { UpdateYearDto } from './dto/update-year.dto';
import { FindYearsQueryDto } from './dto/find-years-query.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { YearRole } from '@/src/common/types/prisma';
import { YearRolesGuard } from '@/src/common/guards/year-roles.guard';
import { YearRoles } from '@/src/common/decorators/year-roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('years')
export class YearsController {
  constructor(private readonly yearsService: YearsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateYearDto) {
    return this.yearsService.create(user.id, dto);
  }

  // Só o ADMIN pode editar o ano
  @Patch(':yearId')
  @UseGuards(YearRolesGuard)
  @YearRoles(YearRole.ADMIN)
  update(@Param('yearId') yearId: string, @Body() dto: UpdateYearDto) {
    return this.yearsService.update(yearId, dto);
  }

  @Get()
  findAllForUser(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindYearsQueryDto,
  ) {
    return this.yearsService.findAllForUser(user.id, query);
  }

  // Precisa vir ANTES de ':yearId' pra não ser interpretado como um id.
  // Só mostra anos onde o usuário é ADMIN (mesma regra de quem pode excluir/restaurar).
  @Get('deleted')
  findDeletedForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.yearsService.findDeletedForUser(user.id);
  }

  // Qualquer papel (inclusive PARTICIPANTE) pode visualizar
  @Get(':yearId')
  @UseGuards(YearRolesGuard)
  findOne(@Param('yearId') yearId: string) {
    return this.yearsService.findOne(yearId);
  }

  // Só o ADMIN pode apagar o ano
  @Delete(':yearId')
  @UseGuards(YearRolesGuard)
  @YearRoles(YearRole.ADMIN)
  remove(@Param('yearId') yearId: string) {
    return this.yearsService.remove(yearId);
  }

  // Só o ADMIN pode restaurar
  @Post(':yearId/restore')
  @UseGuards(YearRolesGuard)
  @YearRoles(YearRole.ADMIN)
  restore(@Param('yearId') yearId: string) {
    return this.yearsService.restore(yearId);
  }

  // Só o ADMIN pode apagar de vez — e só funciona se já estiver na lixeira
  @Delete(':yearId/permanent')
  @UseGuards(YearRolesGuard)
  @YearRoles(YearRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  permanentlyDelete(@Param('yearId') yearId: string) {
    return this.yearsService.permanentlyDelete(yearId);
  }

  // Só o ADMIN pode convidar
  @Post(':yearId/members')
  @UseGuards(YearRolesGuard)
  @YearRoles(YearRole.ADMIN)
  inviteMember(@Param('yearId') yearId: string, @Body() dto: InviteMemberDto) {
    return this.yearsService.inviteMember(yearId, dto);
  }

  // Só o ADMIN pode mudar o papel de alguém
  @Patch(':yearId/members/:memberUserId')
  @UseGuards(YearRolesGuard)
  @YearRoles(YearRole.ADMIN)
  updateMemberRole(
    @Param('yearId') yearId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.yearsService.updateMemberRole(yearId, memberUserId, dto);
  }

  // Só o ADMIN pode remover alguém
  @Delete(':yearId/members/:memberUserId')
  @UseGuards(YearRolesGuard)
  @YearRoles(YearRole.ADMIN)
  removeMember(
    @Param('yearId') yearId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    return this.yearsService.removeMember(yearId, memberUserId);
  }
}
