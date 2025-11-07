import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { ZoomCreditsModule } from '../zoom-credits/zoom-credits.module';
import { ZoomModule } from '../zoom/zoom.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  imports: [PrismaModule, ZoomModule, ZoomCreditsModule, PlatformSettingsModule],
  controllers: [ClassesController],
  providers: [ClassesService, RolesGuard, JwtAuthGuard],
  exports: [ClassesService],
})
export class ClassesModule {}
