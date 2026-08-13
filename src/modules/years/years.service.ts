import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateYearDto } from './dto/create-year.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Prisma, Year, YearMember, YearRole } from '@/src/common/types/prisma';
import { UsersService } from '../users/users.service';
import { UpdateYearDto } from './dto/update-year.dto';
import { FindYearsQueryDto } from './dto/find-years-query.dto';
import { BulkYearIdsDto } from './dto/bulk-year-ids.dto';
import { buildPaginationMeta } from '@/src/common/utils/pagination.util';
import type { PaginatedResult } from '@/src/common/interfaces/paginated-result.interface';
import type { BulkOperationResult } from './interface/bulk-operation-result.interface';

@Injectable()
export class YearsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(userId: string, dto: CreateYearDto): Promise<Year> {
    const existing = await this.prisma.year.findUnique({
      where: { creatorId_year: { creatorId: userId, year: dto.year } },
    });

    if (existing) {
      if (existing.deletedAt) {
        throw new ConflictException(
          'Já existe um ano excluído com esse número. Restaure-o em vez de criar um novo.',
        );
      }
      throw new ConflictException('Você já criou um ano com esse número.');
    }

    // Cria o ano e já registra o criador como ADMIN numa única transação.
    return this.prisma.$transaction(async (tx) => {
      const year = await tx.year.create({
        data: { year: dto.year, creatorId: userId },
      });

      await tx.yearMember.create({
        data: {
          yearId: year.id,
          userId,
          role: YearRole.ADMIN,
          acceptedAt: new Date(),
        },
      });

      return year;
    });
  }

  async update(yearId: string, dto: UpdateYearDto): Promise<Year> {
    const year = await this.prisma.year.findUnique({
      where: { id: yearId },
    });

    if (!year) {
      throw new NotFoundException('Ano não encontrado.');
    }

    if (dto.year !== undefined && dto.year !== year.year) {
      const conflict = await this.prisma.year.findUnique({
        where: {
          creatorId_year: { creatorId: year.creatorId, year: dto.year },
        },
      });

      if (conflict) {
        if (conflict.deletedAt) {
          throw new ConflictException(
            'Já existe um ano excluído com esse número.',
          );
        }
        throw new ConflictException('Você já criou um ano com esse número.');
      }
    }

    return this.prisma.year.update({
      where: { id: yearId },
      data: dto,
    });
  }

  async findAllForUser(
    userId: string,
    query: FindYearsQueryDto,
  ): Promise<PaginatedResult<Year>> {
    const { page, limit, order, years } = query;

    // Filtro no banco, nunca busca tudo pra filtrar depois em memória.
    const where: Prisma.YearWhereInput = {
      deletedAt: null,
      members: { some: { userId } },
      ...(years?.length ? { year: { in: years } } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.year.findMany({
        where,
        orderBy: { year: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.year.count({ where }),
    ]);

    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(yearId: string) {
    const year = await this.prisma.year.findUnique({
      where: { id: yearId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!year || year.deletedAt) {
      throw new NotFoundException('Ano não encontrado.');
    }

    return year;
  }

  async remove(yearId: string): Promise<void> {
    await this.getActiveYearOrThrow(yearId);

    await this.prisma.year.update({
      where: { id: yearId },
      data: { deletedAt: new Date() },
    });
  }

  // Só lista anos onde o usuário é ADMIN — só quem administra
  // pode restaurar, mesma regra de quem pode excluir.
  findDeletedForUser(userId: string): Promise<Year[]> {
    return this.prisma.year.findMany({
      where: {
        deletedAt: { not: null },
        members: { some: { userId, role: YearRole.ADMIN } },
      },
      orderBy: { year: 'desc' },
    });
  }

  async restore(yearId: string): Promise<Year> {
    const year = await this.prisma.year.findUnique({
      where: { id: yearId },
    });

    if (!year || !year.deletedAt) {
      throw new NotFoundException('Ano não encontrado ou não está excluído.');
    }

    return this.prisma.year.update({
      where: { id: yearId },
      data: { deletedAt: null },
    });
  }

  // Delete de verdade — só permitido se o ano já estiver na lixeira.
  // O cascade do schema (onDelete: Cascade) cuida de apagar members,
  // cards, incomes e expenses relacionados automaticamente.
  async permanentlyDelete(yearId: string): Promise<void> {
    const year = await this.prisma.year.findUnique({
      where: { id: yearId },
    });

    if (!year) {
      throw new NotFoundException('Ano não encontrado.');
    }

    if (!year.deletedAt) {
      throw new ConflictException(
        'Só é possível apagar definitivamente um ano que já está na lixeira. Exclua-o primeiro.',
      );
    }

    await this.prisma.year.delete({ where: { id: yearId } });
  }

  private async getActiveYearOrThrow(yearId: string): Promise<Year> {
    const year = await this.prisma.year.findUnique({
      where: { id: yearId },
    });

    if (!year || year.deletedAt) {
      throw new NotFoundException('Ano não encontrado.');
    }

    return year;
  }

  // ==========================================
  // OPERAÇÕES EM MASSA
  // ==========================================
  // Processamento sequencial e por item, não uma única transação —
  // o requisito pede sucesso parcial (quais itens falharam e quais não),
  // o que uma transação única inviabilizaria (qualquer erro reverteria
  // o lote inteiro).

  async removeMany(
    userId: string,
    dto: BulkYearIdsDto,
  ): Promise<BulkOperationResult> {
    return this.processBulk(dto.yearIds, async (yearId) => {
      await this.assertIsYearAdmin(userId, yearId);
      await this.remove(yearId);
    });
  }

  async restoreMany(
    userId: string,
    dto: BulkYearIdsDto,
  ): Promise<BulkOperationResult> {
    return this.processBulk(dto.yearIds, async (yearId) => {
      await this.assertIsYearAdmin(userId, yearId);
      await this.restore(yearId);
    });
  }

  async permanentlyDeleteMany(
    userId: string,
    dto: BulkYearIdsDto,
  ): Promise<BulkOperationResult> {
    return this.processBulk(dto.yearIds, async (yearId) => {
      await this.assertIsYearAdmin(userId, yearId);
      await this.permanentlyDelete(yearId);
    });
  }

  private async processBulk(
    yearIds: string[],
    operation: (yearId: string) => Promise<void>,
  ): Promise<BulkOperationResult> {
    const succeeded: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const yearId of yearIds) {
      try {
        await operation(yearId);
        succeeded.push(yearId);
      } catch (error) {
        failed.push({ id: yearId, reason: this.extractErrorMessage(error) });
      }
    }

    return { succeeded, failed };
  }

  private async assertIsYearAdmin(
    userId: string,
    yearId: string,
  ): Promise<void> {
    const membership = await this.prisma.yearMember.findUnique({
      where: { yearId_userId: { yearId, userId } },
    });

    if (!membership || membership.role !== YearRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para essa ação neste ano.',
      );
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Erro desconhecido.';
  }

  async inviteMember(
    yearId: string,
    dto: InviteMemberDto,
  ): Promise<YearMember> {
    const invitedUser = await this.usersService.findByEmail(dto.email);

    if (!invitedUser) {
      throw new NotFoundException('Nenhum usuário cadastrado com esse e-mail.');
    }

    const existingMembership = await this.prisma.yearMember.findUnique({
      where: { yearId_userId: { yearId, userId: invitedUser.id } },
    });

    if (existingMembership) {
      throw new ConflictException('Esse usuário já faz parte deste ano.');
    }

    return this.prisma.yearMember.create({
      data: { yearId, userId: invitedUser.id, role: dto.role },
    });
  }

  async updateMemberRole(
    yearId: string,
    memberUserId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<YearMember> {
    const membership = await this.getMembershipOrThrow(yearId, memberUserId);

    if (membership.role === YearRole.ADMIN) {
      throw new ForbiddenException(
        'Não é possível alterar o papel do administrador.',
      );
    }

    return this.prisma.yearMember.update({
      where: { id: membership.id },
      data: { role: dto.role },
    });
  }

  async removeMember(yearId: string, memberUserId: string): Promise<void> {
    const membership = await this.getMembershipOrThrow(yearId, memberUserId);

    if (membership.role === YearRole.ADMIN) {
      throw new ForbiddenException(
        'Não é possível remover o administrador do ano.',
      );
    }

    await this.prisma.yearMember.delete({ where: { id: membership.id } });
  }

  private async getMembershipOrThrow(
    yearId: string,
    userId: string,
  ): Promise<YearMember> {
    const membership: YearMember | null =
      await this.prisma.yearMember.findUnique({
        where: { yearId_userId: { yearId, userId } },
      });

    if (!membership) {
      throw new NotFoundException('Esse usuário não faz parte deste ano.');
    }

    return membership;
  }
}
