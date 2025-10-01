import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Auth } from '../../common/decorators/auth.decorator';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { Role } from './entities/role.enum';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'List users with pagination' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Retrieve a single user' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @ApiOkResponse({ type: UserEntity })
  @ApiNotFoundResponse({ description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Update user details' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserEntity })
  @ApiNotFoundResponse({ description: 'User not found' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/status')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user approval status' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @ApiBody({ type: UpdateUserStatusDto })
  @ApiOkResponse({ type: UserEntity })
  @ApiBadRequestResponse({ description: 'Missing rejection reason when rejecting' })
  @ApiNotFoundResponse({ description: 'User not found' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @ApiNoContentResponse({ description: 'User removed successfully' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}