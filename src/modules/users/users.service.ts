import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role as PrismaRole, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PaginatedResponse } from '../../common/interfaces/pagination.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { Role } from './entities/role.enum';
import { UserStatus } from './entities/user-status.enum';
import { UserEntity } from './entities/user.entity';

const PASSWORD_SALT_ROUNDS = 12;

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

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  }

  private toEntity(user: User): UserEntity {
    const { password, ...rest } = user;
    return new UserEntity(rest);
  }
}
