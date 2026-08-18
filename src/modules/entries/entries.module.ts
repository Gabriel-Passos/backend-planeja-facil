import { Module } from '@nestjs/common';
import { IncomesController } from './incomes/incomes.controller';
import { IncomesService } from './incomes/incomes.service';
import { ExpensesController } from './expenses/expenses.controller';
import { ExpensesService } from './expenses/expenses.service';
import { EntryPropagationService } from './entry-propagation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { YearRolesGuard } from '@/src/common/guards/year-roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [IncomesController, ExpensesController],
  providers: [
    IncomesService,
    ExpensesService,
    EntryPropagationService,
    YearRolesGuard,
  ],
})
export class EntriesModule {}
