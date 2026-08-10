import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { YEAR_ROLES_KEY } from '../decorators/year-roles.decorator';
import type { YearMember } from '../../../generated/prisma/client';
import { YearRole } from '../../../generated/prisma/client';
import { AuthenticatedUser } from '@/src/modules/auth/strategies/jwt.strategy';
import { PrismaService } from '@/src/modules/prisma/prisma.service';

interface YearScopedRequest {
  user: AuthenticatedUser;
  params: { yearId?: string };
  yearMembership?: YearMember;
}

@Injectable()
export class YearRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<YearRole[]>(
      YEAR_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<YearScopedRequest>();
    const yearId = request.params.yearId;
    const userId = request.user?.id;

    if (!yearId || !userId) {
      throw new ForbiddenException('Acesso negado a este ano.');
    }

    const membership: YearMember | null =
      await this.prisma.yearMember.findUnique({
        where: { yearId_userId: { yearId, userId } },
      });

    if (!membership) {
      throw new ForbiddenException('Você não faz parte deste ano.');
    }

    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Você não tem permissão para esta ação.');
    }

    // Disponibiliza a membership pro resto da request, se precisar
    request.yearMembership = membership;

    return true;
  }
}
