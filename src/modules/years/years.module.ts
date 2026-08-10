import { Module } from '@nestjs/common';
import { YearsService } from './years.service';
import { YearsController } from './years.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { YearRolesGuard } from '@/src/common/guards/year-roles.guard';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [YearsController],
  providers: [YearsService, YearRolesGuard],
})
export class YearsModule {}
