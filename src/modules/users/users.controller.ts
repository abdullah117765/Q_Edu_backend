import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Auth } from '../../common/decorators/auth.decorator';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { AdminsQueryDto } from './dto/admins-query.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { StudentsQueryDto } from './dto/students-query.dto';
import { TeachersQueryDto } from './dto/teachers-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { Role } from './entities/role.enum';
import { UserEntity } from './entities/user.entity';
import { UserStatus } from './entities/user-status.enum';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('admins')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new admin account' })
  @ApiCreatedResponse({ type: UserEntity })
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.usersService.createAdmin(dto);
  }

  @Post('teachers')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Create a new teacher account' })
  @ApiCreatedResponse({ type: UserEntity })
  createTeacher(@Body() dto: CreateTeacherDto) {
    return this.usersService.createTeacher(dto);
  }

  @Post('students')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Create a new student account' })
  @ApiCreatedResponse({ type: UserEntity })
  createStudent(@Body() dto: CreateStudentDto) {
    return this.usersService.createStudent(dto);
  }

  @Get('admins')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List admins with pagination and filters' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  findAdmins(@Query() query: AdminsQueryDto, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    return this.usersService.findAdmins(query, currentUser ? { id: currentUser.id, role: currentUser.role } : undefined);
  }

  @Get('teachers')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'List teachers with pagination and filters' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  findTeachers(@Query() query: TeachersQueryDto, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    if (currentUser?.role === Role.STUDENT) {
      query.status = UserStatus.APPROVED;
    }
    return this.usersService.findTeachers(
      query,
      currentUser ? { id: currentUser.id, role: currentUser.role } : undefined,
    );
  }

  @Get('students')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'List students with pagination and filters' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  findStudents(@Query() query: StudentsQueryDto, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    if (currentUser?.role === Role.TEACHER && !query.status) {
      query.status = UserStatus.APPROVED;
    }
    return this.usersService.findStudents(
      query,
      currentUser ? { id: currentUser.id, role: currentUser.role } : undefined,
    );
  }

  @Get()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'List users with pagination' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  findAll(@Query() query: PaginationQueryDto, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    return this.usersService.findAll(query, currentUser ? { id: currentUser.id, role: currentUser.role } : undefined);
  }

  @Get(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Retrieve a single user' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @ApiOkResponse({ type: UserEntity })
  @ApiNotFoundResponse({ description: 'User with the specified id was not found.' })
  findOne(@Param('id') id: string, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    const elevatedRoles: Role[] = [Role.SUPER_ADMIN, Role.ACADEMY_OWNER];

    if (currentUser && !elevatedRoles.includes(currentUser.role) && currentUser.id !== id) {
      throw new ForbiddenException('You can only view your own profile.');
    }

    return this.usersService.findOne(
      id,
      currentUser ? { id: currentUser.id, role: currentUser.role } : undefined,
    );
  }

  @Patch(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Update user details' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserEntity })
  @ApiNotFoundResponse({ description: 'User with the specified id was not found.' })
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
  @ApiNotFoundResponse({ description: 'User with the specified id was not found.' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(id, dto);
  }

  @Delete(':id')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiNotFoundResponse({ description: 'User with the specified id was not found.' })
  async remove(@Param('id') id: string): Promise<MessageResponseDto> {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully.' };
  }
}
