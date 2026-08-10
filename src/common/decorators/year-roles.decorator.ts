import { SetMetadata } from '@nestjs/common';
import { YearRole } from '../../../generated/prisma/client';

export const YEAR_ROLES_KEY = 'yearRoles';

/**
 * Marca os papéis permitidos numa rota. Se usado sem argumentos,
 * o guard só exige que o usuário seja membro do ano (qualquer papel).
 */
export const YearRoles = (...roles: YearRole[]) =>
  SetMetadata(YEAR_ROLES_KEY, roles);
