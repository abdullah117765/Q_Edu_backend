import {
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { Role } from '../users/entities/role.enum';
import { NotificationsService } from './notifications.service';

type RequestWithUser = Request & { user?: { id?: string; role?: Role } };

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'List my notifications (newest first)' })
  list(
    @Req() req: RequestWithUser,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.notifications.list(req.user!.id as string, {
      unreadOnly: unreadOnly === 'true',
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Patch(':id/read')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.notifications.markRead(req.user!.id as string, id);
  }

  @Post('read-all')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllRead(@Req() req: RequestWithUser) {
    return this.notifications.markAllRead(req.user!.id as string);
  }
}
