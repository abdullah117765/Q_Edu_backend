import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiesModule } from '../academies/academies.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AcademiesModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard, JwtAuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
