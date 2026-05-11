import {
    Body,
    Controller,
    Delete,
    FileTypeValidator,
    ForbiddenException,
    Get,
    MaxFileSizeValidator,
    Param,
    ParseFilePipe,
    Patch,
    Post,
    Query,
    Req,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { Auth } from '../../common/decorators/auth.decorator';
import { UploadedFile as UploadedFileType } from '../../common/interfaces/uploaded-file.interface';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import { AdminsQueryDto } from './dto/admins-query.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { StudentsQueryDto } from './dto/students-query.dto';
import { TeachersQueryDto } from './dto/teachers-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersDirectoryQueryDto } from './dto/users-directory-query.dto';
import { Role } from './entities/role.enum';
import { UserStatus } from './entities/user-status.enum';
import { UserEntity } from './entities/user.entity';
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
  createTeacher(@Body() dto: CreateTeacherDto, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    return this.usersService.createTeacher(
      dto,
      currentUser ? { id: currentUser.id, role: currentUser.role } : undefined,
    );
  }

  @Post('students')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Create a new student account' })
  @ApiCreatedResponse({ type: UserEntity })
  createStudent(@Body() dto: CreateStudentDto, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    return this.usersService.createStudent(
      dto,
      currentUser ? { id: currentUser.id, role: currentUser.role } : undefined,
    );
  }

  @Get('admins')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List admins with pagination and filters' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  findAdmins(@Query() query: AdminsQueryDto, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    return this.usersService.findAdmins(
      query,
      currentUser ? { id: currentUser.id, role: currentUser.role } : undefined,
    );
  }

  @Get('teachers')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'List teachers with pagination and filters' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  async findTeachers(@Query() query: TeachersQueryDto, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    if (currentUser?.role === Role.STUDENT) {
      query.status = UserStatus.APPROVED;
    }
    const result = await this.usersService.findTeachers(
      query,
      currentUser ? { id: currentUser.id, role: currentUser.role } : undefined,
    );

    if (currentUser?.role === Role.STUDENT) {
      result.data = result.data.map((user) =>
        this.toPublicTeacherDirectoryUser(user),
      ) as typeof result.data;
    }

    return result;
  }

  @Get('students')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'List students with pagination and filters' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  async findStudents(
    @Query() query: StudentsQueryDto,
    @Req() request: Request,
  ) {
    const currentUser = request['user'] as UserEntity | undefined;
    if (currentUser?.role === Role.TEACHER && !query.status) {
      query.status = UserStatus.APPROVED;
    }
    const result = await this.usersService.findStudents(
      query,
      currentUser ? { id: currentUser.id, role: currentUser.role } : undefined,
    );

    if (currentUser?.role === Role.TEACHER) {
      result.data = result.data.map((user) =>
        this.toTeacherStudentDirectoryUser(user),
      ) as typeof result.data;
    }
    return result;
  }

  private toTeacherStudentDirectoryUser(user: UserEntity): UserEntity {
    return this.omitSensitiveDirectoryFields({
      ...user,
      email: this.maskEmail(user.email),
    });
  }

  private toPublicTeacherDirectoryUser(user: UserEntity): UserEntity {
    return this.omitSensitiveDirectoryFields(user);
  }

  private omitSensitiveDirectoryFields(user: UserEntity): UserEntity {
    const {
      phoneNumber,
      gender,
      dateOfBirth,
      addressStreet,
      addressHouse,
      addressCity,
      addressState,
      addressCountry,
      rejectionReason,
      profilePhotoKey,
      ...safeUser
    } = user;
    void phoneNumber;
    void gender;
    void dateOfBirth;
    void addressStreet;
    void addressHouse;
    void addressCity;
    void addressState;
    void addressCountry;
    void rejectionReason;
    void profilePhotoKey;
    return safeUser as UserEntity;
  }

  private maskEmail(email?: string | null): string {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    if (local.length <= 1) return `${local}***@${domain}`;
    return `${local[0]}***@${domain}`;
  }

  @Get()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'List users with pagination' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  findAll(@Query() query: UsersDirectoryQueryDto, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    return this.usersService.findAll(
      query,
      currentUser ? { id: currentUser.id, role: currentUser.role } : undefined,
    );
  }

  @Get('me')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Retrieve the authenticated user profile' })
  @ApiOkResponse({ type: UserEntity })
  getProfile(@Req() request: Request) {
    const currentUser = request['user'] as UserEntity;
    return this.usersService.getOwnProfile(currentUser.id);
  }

  @Patch('me')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ type: UserEntity })
  updateProfile(@Req() request: Request, @Body() dto: UpdateProfileDto) {
    const currentUser = request['user'] as UserEntity;
    return this.usersService.updateOwnProfile(currentUser.id, dto);
  }

  @Patch('me/photo')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Upload or replace the profile photo' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: UserEntity })
  async updateProfilePhoto(
    @Req() request: Request,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(png|jpe?g|gif|webp)$/ }),
        ],
      }),
    )
    file: UploadedFileType,
  ) {
    const currentUser = request['user'] as UserEntity;
    return this.usersService.updateProfilePhoto(currentUser.id, file);
  }

  @Get(':id')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Retrieve a single user' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @ApiOkResponse({ type: UserEntity })
  @ApiNotFoundResponse({
    description: 'User with the specified id was not found.',
  })
  findOne(@Param('id') id: string, @Req() request: Request) {
    const currentUser = request['user'] as UserEntity | undefined;
    const elevatedRoles: Role[] = [Role.SUPER_ADMIN, Role.ACADEMY_OWNER];

    if (
      currentUser &&
      !elevatedRoles.includes(currentUser.role) &&
      currentUser.id !== id
    ) {
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
  @ApiNotFoundResponse({
    description: 'User with the specified id was not found.',
  })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/status')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Update user approval status' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @ApiBody({ type: UpdateUserStatusDto })
  @ApiOkResponse({ type: UserEntity })
  @ApiBadRequestResponse({
    description: 'Missing rejection reason when rejecting',
  })
  @ApiNotFoundResponse({
    description: 'User with the specified id was not found.',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() request: Request,
  ) {
    const currentUser = request['user'] as UserEntity | undefined;
    return this.usersService.updateStatus(
      id,
      dto,
      currentUser ? { id: currentUser.id, role: currentUser.role } : undefined,
    );
  }

  @Delete(':id')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', description: 'User identifier' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiNotFoundResponse({
    description: 'User with the specified id was not found.',
  })
  async remove(@Param('id') id: string): Promise<MessageResponseDto> {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully.' };
  }
}
