import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
    this.from = this.config.get<string>('MAIL_FROM', 'onboarding@resend.dev');
    this.frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
  }

  async sendAccountConfirmationEmail(
    to: string,
    name: string,
    rawToken: string,
  ) {
    const confirmUrl = `${this.frontendUrl}/confirm-account?token=${rawToken}`;

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Confirme sua conta',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Olá, ${name}!</h2>
          <p>Confirme seu cadastro clicando no botão abaixo:</p>
          <p>
            <a href="${confirmUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
              Confirmar conta
            </a>
          </p>
          <p>Este link expira em 24 horas. Se você não criou essa conta, ignore este e-mail.</p>
        </div>
      `,
    });

    if (error) {
      this.logger.error(
        `Falha ao enviar e-mail de confirmação para ${to}`,
        error,
      );
      throw new Error('Não foi possível enviar o e-mail de confirmação.');
    }
  }

  async sendPasswordResetEmail(to: string, name: string, rawToken: string) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${rawToken}`;

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Recuperação de senha',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Olá, ${name}!</h2>
          <p>Recebemos uma solicitação para redefinir sua senha. Se foi você, clique abaixo:</p>
          <p>
            <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
              Redefinir senha
            </a>
          </p>
          <p>Este link expira em 1 hora. Se não foi você, pode ignorar este e-mail com segurança.</p>
        </div>
      `,
    });

    if (error) {
      this.logger.error(
        `Falha ao enviar e-mail de redefinição para ${to}`,
        error,
      );
      throw new Error(
        'Não foi possível enviar o e-mail de redefinição de senha.',
      );
    }
  }
}
