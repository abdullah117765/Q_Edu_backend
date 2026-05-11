import {
    Body,
    Controller,
    Delete,
    Get,
    MaxFileSizeValidator,
    Param,
    ParseFilePipe,
    Patch,
    Post,
    Query,
    Req,
    UploadedFile,
    UnauthorizedException,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { Auth } from '../../common/decorators/auth.decorator';
import { UploadedFile as UploadedFileType } from '../../common/interfaces/uploaded-file.interface';
import { Role } from '../users/entities/role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { CreateUploadedResourceDto } from './dto/create-uploaded-resource.dto';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourcesQueryDto } from './dto/resources-query.dto';
import { PaginatedResourcesResponseDto } from './dto/paginated-resources-response.dto';
import { ResourceEntity } from './entities/resource.entity';
import { ResourcesService } from './resources.service';

type RequestWithUser = Request & { user?: UserEntity };

@ApiTags('resources')
@ApiBearerAuth()
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Create a resource metadata entry' })
  @ApiOkResponse({ type: ResourceEntity })
  async create(
    @Req() request: Request,
    @Body() dto: CreateResourceDto,
  ): Promise<ResourceEntity> {
    const currentUser = (request as RequestWithUser).user;
    if (!currentUser?.id) {
      throw new UnauthorizedException('Authenticated user is required to upload resources.');
    }
    return this.resourcesService.create(currentUser.id, dto);
  }

  @Post('upload')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Upload a local file and create a resource' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: ResourceEntity })
  async upload(
    @Req() request: Request,
    @Body() dto: CreateUploadedResourceDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })],
      }),
    )
    file: UploadedFileType,
  ): Promise<ResourceEntity> {
    const currentUser = (request as RequestWithUser).user;
    if (!currentUser?.id) {
      throw new UnauthorizedException('Authenticated user is required to upload resources.');
    }
    return this.resourcesService.createFromUpload(currentUser.id, dto, file);
  }

  @Get()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'List resources with optional filters' })
  @ApiOkResponse({ type: PaginatedResourcesResponseDto })
  findAll(@Req() request: Request, @Query() query: ResourcesQueryDto): Promise<PaginatedResourcesResponseDto> {
    const currentUser = (request as RequestWithUser).user;
    return this.resourcesService.findAll(query, currentUser);
  }

  @Get(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Fetch a single resource metadata record' })
  @ApiParam({ name: 'id', description: 'Resource identifier' })
  @ApiOkResponse({ type: ResourceEntity })
  findOne(@Req() request: Request, @Param('id') id: string): Promise<ResourceEntity> {
    const currentUser = (request as RequestWithUser).user;
    return this.resourcesService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Update resource metadata' })
  @ApiParam({ name: 'id', description: 'Resource identifier' })
  @ApiBody({ type: UpdateResourceDto })
  @ApiOkResponse({ type: ResourceEntity })
  update(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ): Promise<ResourceEntity> {
    const currentUser = (request as RequestWithUser).user;
    if (!currentUser?.id) {
      throw new UnauthorizedException('Authenticated user is required to update resources.');
    }
    return this.resourcesService.update(id, dto, currentUser);
  }

  @Patch(':id/upload')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Replace a resource file and update metadata' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Resource identifier' })
  @ApiOkResponse({ type: ResourceEntity })
  updateWithUpload(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() dto: CreateUploadedResourceDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })],
      }),
    )
    file: UploadedFileType,
  ): Promise<ResourceEntity> {
    const currentUser = (request as RequestWithUser).user;
    if (!currentUser?.id) {
      throw new UnauthorizedException('Authenticated user is required to update resources.');
    }
    return this.resourcesService.updateWithUpload(id, dto, file, currentUser);
  }

  @Delete(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Delete a resource metadata entry' })
  @ApiParam({ name: 'id', description: 'Resource identifier' })
  @ApiOkResponse({ description: 'Resource removed' })
  async remove(@Req() request: Request, @Param('id') id: string): Promise<{ message: string }> {
    const currentUser = (request as RequestWithUser).user;
    if (!currentUser?.id) {
      throw new UnauthorizedException('Authenticated user is required to delete resources.');
      }
    await this.resourcesService.remove(id, currentUser);
    return { message: 'Resource deleted successfully.' };
  }
}
