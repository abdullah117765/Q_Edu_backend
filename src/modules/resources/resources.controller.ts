import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { Role } from '../users/entities/role.enum';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourcesQueryDto } from './dto/resources-query.dto';
import { PaginatedResourcesResponseDto } from './dto/paginated-resources-response.dto';
import { ResourceEntity } from './entities/resource.entity';
import { ResourcesService } from './resources.service';

type RequestWithUser = Request & { user?: { id?: string } };

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
    const uploaderId = (request as RequestWithUser).user?.id;
    return this.resourcesService.create(uploaderId as string, dto);
  }

  @Get()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'List resources with optional filters' })
  @ApiOkResponse({ type: PaginatedResourcesResponseDto })
  findAll(@Req() request: Request, @Query() query: ResourcesQueryDto): Promise<PaginatedResourcesResponseDto> {
    const uploaderId = (request as RequestWithUser).user?.id;
    return this.resourcesService.findAll(query, uploaderId);
  }

  @Get(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Fetch a single resource metadata record' })
  @ApiParam({ name: 'id', description: 'Resource identifier' })
  @ApiOkResponse({ type: ResourceEntity })
  findOne(@Param('id') id: string): Promise<ResourceEntity> {
    return this.resourcesService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Update resource metadata' })
  @ApiParam({ name: 'id', description: 'Resource identifier' })
  @ApiBody({ type: UpdateResourceDto })
  @ApiOkResponse({ type: ResourceEntity })
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto): Promise<ResourceEntity> {
    return this.resourcesService.update(id, dto);
  }

  @Delete(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Delete a resource metadata entry' })
  @ApiParam({ name: 'id', description: 'Resource identifier' })
  @ApiOkResponse({ description: 'Resource removed' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.resourcesService.remove(id);
    return { message: 'Resource deleted successfully.' };
  }
}
