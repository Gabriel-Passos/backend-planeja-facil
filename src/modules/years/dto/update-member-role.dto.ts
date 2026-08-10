import { YearRole } from '@/src/common/types/prisma';
import { IsIn } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsIn([YearRole.EDITOR, YearRole.PARTICIPANTE])
  role!: YearRole;
}
