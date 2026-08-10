import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '@/src/modules/users/users.service';
import { MailService } from '@/src/modules/mail/mail.service';
import { generateRawToken, hashToken } from '@/src/common/utils/token.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type {
  EmailVerificationToken,
  PasswordResetToken,
  RefreshToken,
} from '@/src/common/types/prisma';

const EMAIL_VERIFICATION_EXPIRATION_HOURS = 24;
const PASSWORD_RESET_EXPIRATION_HOURS = 1;
const REFRESH_TOKEN_EXPIRATION_DAYS = 30;
const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Já existe uma conta com esse e-mail.');
    }

    const user = await this.usersService.create(
      dto.name,
      dto.email,
      dto.password,
    );

    await this.issueEmailVerificationToken(user.id, user.name, user.email);

    return {
      message:
        'Cadastro realizado. Verifique seu e-mail para confirmar a conta.',
    };
  }

  async confirmAccount(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    const verificationToken: EmailVerificationToken | null =
      await this.prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
      });

    if (
      !verificationToken ||
      verificationToken.usedAt ||
      verificationToken.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Token de confirmação inválido ou expirado.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: { isEmailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Conta confirmada com sucesso.' };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    // Login permitido mesmo sem confirmar o e-mail — a confirmação vira um
    // aviso dentro da plataforma, não um bloqueio de acesso.

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    const rawRefreshToken = generateRawToken();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(rawRefreshToken),
        userId: user.id,
        expiresAt: new Date(
          Date.now() + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    // Sempre responde com a mesma mensagem, exista o e-mail ou não —
    // evita que alguém descubra quais e-mails estão cadastrados (enumeration attack).
    const genericResponse = {
      message:
        'Se o e-mail existir em nossa base, enviaremos as instruções de redefinição.',
    };

    if (!user) {
      return genericResponse;
    }

    const rawToken = generateRawToken();

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(rawToken),
        userId: user.id,
        expiresAt: new Date(
          Date.now() + PASSWORD_RESET_EXPIRATION_HOURS * 60 * 60 * 1000,
        ),
      },
    });

    await this.mailService.sendPasswordResetEmail(
      user.email,
      user.name,
      rawToken,
    );

    return genericResponse;
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = hashToken(rawToken);

    const resetToken: PasswordResetToken | null =
      await this.prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException(
        'Token de redefinição inválido ou expirado.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Revoga todos os refresh tokens ativos: se a senha vazou,
      // qualquer sessão aberta com o token antigo deixa de valer.
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Senha redefinida com sucesso.' };
  }

  private async issueEmailVerificationToken(
    userId: string,
    name: string,
    email: string,
  ) {
    const rawToken = generateRawToken();

    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash: hashToken(rawToken),
        userId,
        expiresAt: new Date(
          Date.now() + EMAIL_VERIFICATION_EXPIRATION_HOURS * 60 * 60 * 1000,
        ),
      },
    });

    // Envio de e-mail é best-effort: se falhar (provedor fora do ar,
    // limite de teste do Resend, etc.), a conta já foi criada com sucesso
    // e o token de verificação já existe no banco — não faz sentido
    // derrubar o cadastro inteiro por causa disso. Só logamos o erro.
    try {
      await this.mailService.sendAccountConfirmationEmail(
        email,
        name,
        rawToken,
      );
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail de confirmação para ${email} (usuário ${userId} já foi criado)`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async refreshTokens(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);

    const storedToken: RefreshToken | null =
      await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    if (storedToken.revokedAt) {
      // Um token já revogado sendo reaproveitado é sinal de roubo/reuso indevido.
      // Por segurança, revogamos TODAS as sessões ativas desse usuário.
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expirado.');
    }

    const user = await this.usersService.findById(storedToken.userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    const rawNewRefreshToken = generateRawToken();

    // Transação interativa: cria o novo token e já revoga/encadeia o antigo,
    // garantindo que a rotação nunca fique "pela metade".
    const refreshToken = await this.prisma.$transaction(async (tx) => {
      const newToken: RefreshToken = await tx.refreshToken.create({
        data: {
          tokenHash: hashToken(rawNewRefreshToken),
          userId: user.id,
          expiresAt: new Date(
            Date.now() + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
      });

      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date(), replacedByTokenId: newToken.id },
      });

      return rawNewRefreshToken;
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return { accessToken, refreshToken };
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);

    // updateMany não lança erro se não encontrar nada — logout é idempotente,
    // não precisa dizer pro cliente se o token já estava inválido ou não.
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logout realizado com sucesso.' };
  }
}
