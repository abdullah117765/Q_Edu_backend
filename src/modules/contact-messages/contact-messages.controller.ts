import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import { Role } from '../users/entities/role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { ContactMessagesService } from './contact-messages.service';
import { ContactMessagesQueryDto } from './dto/contact-messages-query.dto';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { UpdateContactMessageStatusDto } from './dto/update-contact-message-status.dto';

@ApiTags('contact-messages')
@Controller('contact-messages')
export class ContactMessagesController {
  constructor(private readonly contactMessages: ContactMessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a public contact message' })
  create(@Body() dto: CreateContactMessageDto) {
    return this.contactMessages.create(dto);
  }

  @Get('admin')
  @ApiBearerAuth()
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List contact messages for super admin inbox' })
  list(@Query() query: ContactMessagesQueryDto) {
    return this.contactMessages.list(query);
  }

  @Patch('admin/:id/status')
  @ApiBearerAuth()
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update contact message status' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactMessageStatusDto,
    @Req() request: Request,
  ) {
    const actor = request['user'] as UserEntity;
    return this.contactMessages.updateStatus(id, dto, actor.id);
  }

  @Patch('admin/:id/read')
  @ApiBearerAuth()
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark contact message as in review' })
  async markRead(@Param('id') id: string, @Req() request: Request): Promise<MessageResponseDto> {
    const actor = request['user'] as UserEntity;
    await this.contactMessages.markReviewed(id, actor.id);
    return { message: 'Contact message marked as in review.' };
  }
}
