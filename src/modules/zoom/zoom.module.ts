import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ZoomService } from './zoom.service';

@Module({
  imports: [ConfigModule],
  providers: [ZoomService],
  exports: [ZoomService],
})
export class ZoomModule {}
