import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@/src/modules/auth/auth.module';
import { MailModule } from '@/src/modules/mail/mail.module';
import { UsersModule } from '@/src/modules/users/users.module';
import { PrismaModule } from '@/src/modules/prisma/prisma.module';
import { YearsModule } from '@/src/modules/years/years.module';
import { MonthCardsModule } from '@/src/modules/month-cards/month-cards.module';
import { EntriesModule } from '@/src/modules/entries/entries.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    MailModule,
    UsersModule,
    PrismaModule,
    YearsModule,
    MonthCardsModule,
    EntriesModule,
  ],
})
export class AppModule {}
