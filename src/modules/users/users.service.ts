import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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

    const hashedPassword = await this.hashPassword(dto.password);
    const role = dto.role ?? Role.STUDENT;
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        role,
        status: role === Role.SUPER_ADMIN ? UserStatus.APPROVED : undefined,
        isActive: role === Role.SUPER_ADMIN ? true : undefined,
      },
    });

    return this.toEntity(user);
  }

  async findAll(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map((user) => this.toEntity(user));
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return this.toEntity(user);
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    const data: Prisma.UserUpdateInput = {
      firstName: dto.firstName ?? existing.firstName,
      lastName: dto.lastName ?? existing.lastName,
      phoneNumber: dto.phoneNumber ?? existing.phoneNumber,
      role: dto.role ?? existing.role,
      isActive: dto.isActive ?? existing.isActive,
    };

    if (dto.password) {
      data.password = await this.hashPassword(dto.password);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.toEntity(user);
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found.');
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
      updateData.isActive = dto.status === UserStatus.APPROVED;
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
      throw new NotFoundException('User not found.');
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