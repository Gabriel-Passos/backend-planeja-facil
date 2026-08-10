import { YearRole } from '@/src/common/types/prisma';
import { IsEmail, IsIn } from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  // Só permitimos convidar como EDITOR ou PARTICIPANTE.
  // ADMIN é exclusivo de quem criou o ano.
  @IsIn([YearRole.EDITOR, YearRole.PARTICIPANTE])
  role!: YearRole;
}
