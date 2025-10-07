import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ZoomCreditsController } from './zoom-credits.controller';
import { ZoomCreditsService } from './zoom-credits.service';

@Module({
  imports: [PrismaModule],
  controllers: [ZoomCreditsController],
  providers: [ZoomCreditsService],
  exports: [ZoomCreditsService],
})
export class ZoomCreditsModule {}
