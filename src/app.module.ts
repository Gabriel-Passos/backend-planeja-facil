import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@/src/modules/auth/auth.module';
import { MailModule } from '@/src/modules/mail/mail.module';
import { UsersModule } from '@/src/modules/users/users.module';
import { PrismaModule } from '@/src/modules/prisma/prisma.module';
import { YearsModule } from '@/src/modules/years/years.module';
import { MonthCardsModule } from '@/src/modules/month-cards/month-cards.module';
import { IncomesService } from './modules/entries/incomes/incomes.service';
import { IncomesController } from './modules/entries/incomes/incomes.controller';
import { ExpensesService } from './modules/entries/expenses/expenses.service';
import { ExpensesController } from './modules/entries/expenses/expenses.controller';
import { EntriesModule } from './modules/entries/entries.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ConfigService disponível em todo o app sem precisar reimportar
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
  providers: [IncomesService, ExpensesService],
  controllers: [IncomesController, ExpensesController],
})
export class AppModule {}
