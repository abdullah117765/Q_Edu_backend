import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PasswordResetToken, Role as PrismaRole, RefreshToken, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Role } from '../users/entities/role.enum';
import { UserStatus } from '../users/entities/user-status.enum';
import { UserEntity } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResendRegistrationOtpDto } from './dto/resend-registration-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyRegistrationOtpDto } from './dto/verify-registration-otp.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

const PASSWORD_SALT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;
const RESEND_WINDOW_SECONDS = 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
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
      throw new UnauthorizedException('Account is not active. Please verify your email.');
    }

    return this.issueTokensForUser(user);
  }

  async register(createUserDto: CreateUserDto): Promise<MessageResponseDto> {
    const role = createUserDto.role ?? Role.STUDENT;
    if (role === Role.SUPER_ADMIN) {
      const superAdminExists = await this.prisma.user.count({ where: { role: PrismaRole.SUPER_ADMIN } });
      if (superAdminExists > 0) {
        throw new BadRequestException('A super admin account already exists.');
      }
    }

    const userEntity = await this.usersService.create(createUserDto);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userEntity.id } });

    const otp = await this.createEmailVerificationToken(user.id);
    const mailSent = await this.mailService.sendRegistrationOtp(user.email, otp);
    if (!mailSent) {
      this.logger.warn(`Registration email delivery failed for ${user.email}`);
    }

    return {
      message: 'Registration successful. Verify the OTP sent to your email to activate your account.',
    };
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

  async resendRegistrationOtp(dto: ResendRegistrationOtpDto): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('No account found for the provided email address.');
    }

    if (user.isActive) {
      throw new BadRequestException('Account is already active.');
    }

    const existingToken = await this.prisma.emailVerificationToken.findUnique({ where: { userId: user.id } });
    if (existingToken) {
      const secondsSinceCreation = (Date.now() - existingToken.createdAt.getTime()) / 1000;
      if (secondsSinceCreation < RESEND_WINDOW_SECONDS) {
        throw new BadRequestException('OTP recently sent. Please wait before requesting another.');
      }
      await this.prisma.emailVerificationToken.delete({ where: { userId: user.id } });
    }

    const otp = await this.createEmailVerificationToken(user.id);
    const mailSent = await this.mailService.sendRegistrationOtp(user.email, otp);
    if (!mailSent) {
      this.logger.warn(`Registration email delivery failed for ${user.email}`);
    }

    return { message: 'A new OTP has been sent to your email address.' };
  }

  async verifyRegistrationOtp(dto: VerifyRegistrationOtpDto): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('No account found for the provided email address.');
    }

    const tokenRecord = await this.prisma.emailVerificationToken.findUnique({ where: { userId: user.id } });
    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    if (tokenRecord.consumedAt) {
      throw new UnauthorizedException('OTP already used.');
    }

    if (tokenRecord.expiresAt.getTime() <= Date.now()) {
      await this.prisma.emailVerificationToken.delete({ where: { userId: user.id } });
      throw new UnauthorizedException('OTP expired.');
    }

    if (tokenRecord.otpHash !== this.hashOtp(dto.otp)) {
      throw new UnauthorizedException('Invalid OTP.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { userId: user.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    return { message: 'Account verified successfully. You can now sign in.' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('No account found for the provided email address.');
    }

    if (!user.isActive) {
      throw new BadRequestException('Account is not active. Complete email verification before resetting the password.');
    }

    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const otp = this.generateOtp();
    const otpHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt,
      },
    });

    this.logger.log(`Password reset OTP for user ${user.id}: ${otp}`);
    console.log(`[OTP][PasswordReset] user=${user.id} otp=${otp}`);

    const mailSent = await this.mailService.sendPasswordResetOtp(user.email, otp);
    if (!mailSent) {
      this.logger.warn(`Password reset email delivery failed for ${user.email}`);
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('No account found for the provided email address.');
    }

    const tokenRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        otpHash: this.hashOtp(dto.otp),
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    if (tokenRecord.expiresAt.getTime() <= Date.now()) {
      await this.invalidatePasswordResetToken(tokenRecord);
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, PASSWORD_SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, PASSWORD_SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
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

  private async createEmailVerificationToken(userId: string): Promise<string> {
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId } });

    const otp = this.generateOtp();
    const otpHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        otpHash,
        expiresAt,
      },
    });

    this.logger.log(`Registration OTP for user ${userId}: ${otp}`);
    console.log(`[OTP][Registration] user=${userId} otp=${otp}`);

    return otp;
  }

  private async invalidateToken(tokenRecord: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
  }

  private async invalidatePasswordResetToken(token: PasswordResetToken): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private signToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('auth.jwtAccessSecret'),
      expiresIn: this.configService.get<string>('auth.jwtAccessExpiresIn'),
    });
  }

  getAccessTokenTtlMs(): number {
    const raw = this.configService.get<string>('auth.jwtAccessExpiresIn') ?? '15m';
    return this.parseDurationToMilliseconds(raw);
  }

  getRefreshTokenTtlMs(): number {
    const ttlSeconds = this.configService.get<number>('auth.refreshTokenTtlSeconds') ?? 604800;
    return ttlSeconds * 1000;
  }

  private parseDurationToMilliseconds(input: string): number {
    if (!input) {
      return 15 * 60 * 1000;
    }

    const trimmed = input.trim();
    const match = /^(\d+)([smhd])$/i.exec(trimmed);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const factor: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
      };
      const multiplier = factor[unit] ?? factor.m;
      return value * multiplier;
    }

    const numeric = Number.parseInt(trimmed, 10);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric * 1000;
    }

    return 15 * 60 * 1000;
  }
}
