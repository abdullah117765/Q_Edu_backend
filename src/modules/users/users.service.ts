import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role as PrismaRole, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PaginatedResponse } from '../../common/interfaces/pagination.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AdminsQueryDto } from './dto/admins-query.dto';
import { StudentsQueryDto } from './dto/students-query.dto';
import { TeachersQueryDto } from './dto/teachers-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { Role } from './entities/role.enum';
import { UserStatus } from './entities/user-status.enum';
import { UserEntity } from './entities/user.entity';

const PASSWORD_SALT_ROUNDS = 12;

type RoleQueryDto = AdminsQueryDto | TeachersQueryDto | StudentsQueryDto;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email address is already in use.');
    }

    const role = dto.role ?? Role.STUDENT;
    if (role === Role.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.user.count({ where: { role: PrismaRole.SUPER_ADMIN } });
      if (superAdminCount > 0) {
        throw new ConflictException('A super admin already exists.');
      }
    }

    const hashedPassword = await this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        role,
        status: role === Role.SUPER_ADMIN ? UserStatus.APPROVED : undefined,
        isActive: false,
      },
    });

    return this.toEntity(user);
  }

  async createAdmin(dto: CreateAdminDto): Promise<UserEntity> {
    return this.create({ ...(dto as CreateUserDto), role: Role.ACADEMY_OWNER });
  }

  async createTeacher(dto: CreateTeacherDto): Promise<UserEntity> {
    return this.create({ ...(dto as CreateUserDto), role: Role.TEACHER });
  }

  async createStudent(dto: CreateStudentDto): Promise<UserEntity> {
    return this.create({ ...(dto as CreateUserDto), role: Role.STUDENT });
  }

  async findAll(pagination: PaginationQueryDto): Promise<PaginatedResponse<UserEntity>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = users.map((user) => this.toEntity(user));
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        count: data.length,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
        currentPage: page,
        totalPages,
      },
    };
  }

  async findAdmins(query: AdminsQueryDto): Promise<PaginatedResponse<UserEntity>> {
    return this.findByRole(Role.ACADEMY_OWNER, query);
  }

  async findTeachers(query: TeachersQueryDto): Promise<PaginatedResponse<UserEntity>> {
    return this.findByRole(Role.TEACHER, query);
  }

  async findStudents(query: StudentsQueryDto): Promise<PaginatedResponse<UserEntity>> {
    return this.findByRole(Role.STUDENT, query);
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User with the specified id was not found.');
    }
    return this.toEntity(user);
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    if (dto.role === Role.SUPER_ADMIN && existing.role !== PrismaRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot promote user to super admin.');
    }

    const data: Prisma.UserUpdateInput = {
      firstName: dto.firstName ?? existing.firstName,
      lastName: dto.lastName ?? existing.lastName,
      phoneNumber: dto.phoneNumber ?? existing.phoneNumber,
      role: dto.role ?? existing.role,
      isActive: dto.isActive ?? existing.isActive,
    };

    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.toEntity(user);
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    const updateData: Prisma.UserUpdateInput = {
      status: dto.status,
    };

    if (dto.status === UserStatus.REJECTED) {
      if (!dto.rejectionReason?.trim()) {
        throw new BadRequestException('rejectionReason is required when rejecting a user.');
      }
      updateData.rejectionReason = dto.rejectionReason.trim();
      updateData.isActive = false;
    } else {
      updateData.rejectionReason = null;
      updateData.isActive = dto.status === UserStatus.APPROVED ? true : existing.isActive;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return this.toEntity(user);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    await this.prisma.user.delete({ where: { id } });
  }

  private async findByRole(role: Role, query: RoleQueryDto): Promise<PaginatedResponse<UserEntity>> {
    const where: Prisma.UserWhereInput = {
      role,
      ...(query.status ? { status: query.status } : {}),
    };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { firstName: { contains: search,  } },
        { lastName: { contains: search,  } },
        { email: { contains: search,  } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    const data = users.map((user) => this.toEntity(user));
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      data,
      meta: {
        total,
        count: data.length,
        nextPage: query.page < totalPages ? query.page + 1 : null,
        previousPage: query.page > 1 ? query.page - 1 : null,
        currentPage: query.page,
        totalPages,
      },
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  }

  private toEntity(user: User): UserEntity {
    const { password, ...rest } = user;
    return new UserEntity(rest);
  }
}

