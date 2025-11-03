import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AcademiesModule } from '../academies/academies.module';
import { AcademySettingsController } from './academy-settings.controller';
import { AcademySettingsService } from './academy-settings.service';

@Module({
  imports: [PrismaModule, AcademiesModule],
  controllers: [AcademySettingsController],
  providers: [AcademySettingsService],
})
export class AcademySettingsModule {}
