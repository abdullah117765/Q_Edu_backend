import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { AcademiesController } from './academies.controller';
import { AcademiesService } from './academies.service';

@Module({
  imports: [PrismaModule, PlatformSettingsModule],
  controllers: [AcademiesController],
  providers: [AcademiesService],
  exports: [AcademiesService],
})
export class AcademiesModule {}
