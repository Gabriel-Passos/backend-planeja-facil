import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IncomesController } from './incomes/incomes.controller';
import { ExpensesController } from './expenses/expenses.controller';
import { IncomesService } from './incomes/incomes.service';
import { ExpensesService } from './expenses/expenses.service';
import { YearRolesGuard } from '@/src/common/guards/year-roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [IncomesController, ExpensesController],
  providers: [IncomesService, ExpensesService, YearRolesGuard],
})
export class EntriesModule {}
