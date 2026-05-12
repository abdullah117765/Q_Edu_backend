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
import { ClassesService } from './classes.service';
import { CancelClassDto } from './dto/cancel-class.dto';
import { ClassParticipantsQueryDto } from './dto/class-participants-query.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { ListClassesQueryDto } from './dto/list-classes-query.dto';
import { PaginatedClassParticipantsResponseDto } from './dto/paginated-class-participants-response.dto';
import { PaginatedClassesResponseDto } from './dto/paginated-classes-response.dto';
import { RecreateClassDto } from './dto/recreate-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassEntity } from './entities/class.entity';
type RequestWithUser = Request & { user?: { id?: string; role?: Role } };

@ApiTags('classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
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
    @Req() request: Request,
  ): Promise<PaginatedClassesResponseDto> {
    const { id: actorId, role: actorRole } =
      (request as RequestWithUser).user ?? {};
    return this.classesService.findAll(query, actorId, actorRole);
  }

  @Get(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Retrieve a class by id' })
  @ApiParam({ name: 'id', description: 'Class identifier' })
  @ApiOkResponse({ type: ClassEntity })
  @ApiNotFoundResponse({ description: 'Class not found' })
  findOne(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<ClassEntity> {
    const { id: actorId, role: actorRole } =
      (request as RequestWithUser).user ?? {};
    return this.classesService.findOne(id, actorId, actorRole);
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
  @ApiOperation({
    summary: 'Delete an ended or cancelled class and associated Zoom meeting',
  })
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

  @Post(':id/cancel')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Cancel a scheduled class with a reason' })
  @ApiParam({ name: 'id', description: 'Class identifier' })
  @ApiOkResponse({ type: ClassEntity })
  @ApiBadRequestResponse({
    description: 'Cancellation reason missing or class cannot be cancelled',
  })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelClassDto,
    @Req() request: Request,
  ): Promise<ClassEntity> {
    const { id: actorId, role: actorRole } =
      (request as RequestWithUser).user ?? {};
    return this.classesService.cancel(id, dto, actorId, actorRole);
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
    @Req() request: Request,
  ): Promise<PaginatedClassParticipantsResponseDto> {
    const { id: actorId, role: actorRole } =
      (request as RequestWithUser).user ?? {};
    return this.classesService.getParticipants(id, query, actorId, actorRole);
  }

  @Post(':id/sync-participants')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({
    summary: 'Fetch participants from Zoom and replace local records',
  })
  @ApiParam({ name: 'id', description: 'Class identifier' })
  async syncParticipants(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<MessageResponseDto> {
    const { id: actorId, role: actorRole } =
      (request as RequestWithUser).user ?? {};
    const count = await this.classesService.syncParticipantsFromZoom(
      id,
      actorId,
      actorRole,
    );
    return { message: `Synced ${count} participants from Zoom.` };
  }

  @Post(':id/end')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Explicitly end a class (teacher action)' })
  @ApiParam({ name: 'id', description: 'Class identifier' })
  @ApiOkResponse({ type: ClassEntity })
  @ApiBadRequestResponse({ description: 'Class is already ended or cancelled' })
  async endClass(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<ClassEntity> {
    const { id: actorId, role: actorRole } =
      (request as RequestWithUser).user ?? {};
    return this.classesService.endClass(id, actorId, actorRole);
  }

  @Post(':id/recreate')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({
    summary:
      'Recreate a class with the same participants at the same or a new time',
  })
  @ApiParam({ name: 'id', description: 'Original class identifier' })
  @ApiCreatedResponse({ type: ClassEntity })
  @ApiBadRequestResponse({
    description: 'Invalid schedule or insufficient credits',
  })
  async recreateClass(
    @Param('id') id: string,
    @Body() dto: RecreateClassDto,
    @Req() request: Request,
  ): Promise<ClassEntity> {
    const { id: actorId, role: actorRole } =
      (request as RequestWithUser).user ?? {};
    return this.classesService.recreateClass(id, dto, actorId, actorRole);
  }
}
