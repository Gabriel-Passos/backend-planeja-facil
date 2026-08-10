import { Module } from '@nestjs/common';
import { MonthCardsController } from './month-cards.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MonthCardsService } from './month-cards.service';
import { YearRolesGuard } from '@/src/common/guards/year-roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [MonthCardsController],
  providers: [MonthCardsService, YearRolesGuard],
})
export class MonthCardsModule {}
