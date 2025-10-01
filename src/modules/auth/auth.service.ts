import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken, User } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { Role } from '../users/entities/role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { UserStatus } from '../users/entities/user-status.enum';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.status !== UserStatus.APPROVED) {
      throw new UnauthorizedException('Account is not approved.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled.');
    }

    return this.issueTokensForUser(user);
  }

  async register(createUserDto: CreateUserDto): Promise<AuthResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return this.issueTokensForUser(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const hashedToken = this.hashRefreshToken(dto.refreshToken);
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { hashedToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (tokenRecord.expiresAt.getTime() <= Date.now()) {
      await this.invalidateToken(tokenRecord);
      throw new UnauthorizedException('Refresh token expired.');
    }

    if (!tokenRecord.user.isActive) {
      await this.invalidateToken(tokenRecord);
      throw new UnauthorizedException('Account is disabled.');
    }

    if (tokenRecord.user.status !== UserStatus.APPROVED) {
      await this.invalidateToken(tokenRecord);
      throw new UnauthorizedException('Account is not approved.');
    }

    await this.invalidateToken(tokenRecord);

    return this.issueTokensForUser(tokenRecord.user);
  }

  async logout(userId: string, dto?: LogoutDto): Promise<void> {
    if (dto?.refreshToken) {
      const hashedToken = this.hashRefreshToken(dto.refreshToken);
      await this.prisma.refreshToken.deleteMany({ where: { userId, hashedToken } });
      return;
    }

    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private async issueTokensForUser(user: User | UserEntity): Promise<AuthResponseDto> {
    const userEntity = user instanceof UserEntity ? user : this.toEntity(user);

    const payload: JwtPayload = {
      sub: userEntity.id,
      email: userEntity.email,
      role: userEntity.role as Role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.signToken(payload),
      this.createRefreshToken(userEntity.id),
    ]);

    return {
      accessToken,
      refreshToken,
      user: userEntity,
    };
  }

  private toEntity(user: User): UserEntity {
    return new UserEntity({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role as Role,
      status: user.status as UserStatus,
      rejectionReason: user.rejectionReason,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  private async createRefreshToken(userId: string): Promise<string> {
    await this.prisma.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });

    const token = randomBytes(64).toString('hex');
    const hashedToken = this.hashRefreshToken(token);
    const ttlSeconds = this.configService.get<number>('auth.refreshTokenTtlSeconds') ?? 604800;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        hashedToken,
        expiresAt,
      },
    });

    return token;
  }

  private async invalidateToken(tokenRecord: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private signToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('auth.jwtAccessSecret'),
      expiresIn: this.configService.get<string>('auth.jwtAccessExpiresIn'),
    });
  }
}