import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import { Role } from '../users/entities/role.enum';
import { CreateClassDto } from './dto/create-class.dto';
import { ClassParticipantsQueryDto } from './dto/class-participants-query.dto';
import { ListClassesQueryDto } from './dto/list-classes-query.dto';
import { PaginatedClassParticipantsResponseDto } from './dto/paginated-class-participants-response.dto';
import { PaginatedClassesResponseDto } from './dto/paginated-classes-response.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassEntity } from './entities/class.entity';
import { ClassesService } from './classes.service';
type RequestWithUser = Request & { user?: { id?: string; role?: Role } };

@ApiTags('classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Create a new class and provision a Zoom meeting' })
  @ApiCreatedResponse({ type: ClassEntity })
  async create(
    @Body() dto: CreateClassDto,
    @Req() request: Request,
  ): Promise<ClassEntity> {
    const { id: actorId, role: actorRole } =
      (request as RequestWithUser).user ?? {};
    return this.classesService.create(dto, actorId, actorRole);
  }

  @Get()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'List classes with pagination and filters' })
  @ApiOkResponse({ type: PaginatedClassesResponseDto })
  findAll(
    @Query() query: ListClassesQueryDto,
  ): Promise<PaginatedClassesResponseDto> {
    return this.classesService.findAll(query);
  }

  @Get(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Retrieve a class by id' })
  @ApiParam({ name: 'id', description: 'Class identifier' })
  @ApiOkResponse({ type: ClassEntity })
  @ApiNotFoundResponse({ description: 'Class not found' })
  findOne(@Param('id') id: string): Promise<ClassEntity> {
    return this.classesService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Update class details and sync changes to Zoom' })
  @ApiParam({ name: 'id', description: 'Class identifier' })
  @ApiOkResponse({ type: ClassEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @Req() request: Request,
  ): Promise<ClassEntity> {
    const { id: actorId, role: actorRole } =
      (request as RequestWithUser).user ?? {};
    return this.classesService.update(id, dto, actorId, actorRole);
  }

  @Delete(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Delete a class and associated Zoom meeting' })
  @ApiParam({ name: 'id', description: 'Class identifier' })
  @ApiOkResponse({ type: MessageResponseDto })
  async remove(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<MessageResponseDto> {
    const { id: actorId, role: actorRole } =
      (request as RequestWithUser).user ?? {};
    await this.classesService.remove(id, actorId, actorRole);
    return { message: 'Class deleted successfully.' };
  }

  @Get(':id/participants')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({
    summary: 'Retrieve stored participants for a class (raw SQL optimized)',
  })
  @ApiParam({ name: 'id', description: 'Class identifier' })
  @ApiOkResponse({ type: PaginatedClassParticipantsResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid pagination or filter supplied',
  })
  getParticipants(
    @Param('id') id: string,
    @Query() query: ClassParticipantsQueryDto,
  ): Promise<PaginatedClassParticipantsResponseDto> {
    return this.classesService.getParticipants(id, query);
  }

  @Post(':id/sync-participants')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({
    summary: 'Fetch participants from Zoom and replace local records',
  })
  @ApiParam({ name: 'id', description: 'Class identifier' })
  async syncParticipants(@Param('id') id: string): Promise<MessageResponseDto> {
    const count = await this.classesService.syncParticipantsFromZoom(id);
    return { message: `Synced ${count} participants from Zoom.` };
  }
}
