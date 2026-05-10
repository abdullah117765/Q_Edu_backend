import { Body, Controller, HttpCode, HttpStatus, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Request, Response } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Role } from '../users/entities/role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or account not approved' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const payload = await this.authService.login(loginDto);
    this.setAuthCookies(res, payload);
    return payload;
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  register(@Body() createUserDto: CreateUserDto): Promise<MessageResponseDto> {
    return this.authService.register(createUserDto);
  }

  @Post('resend-otp')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the email verification OTP' })
  @ApiBody({ type: ResendRegistrationOtpDto })
  @ApiOkResponse({ type: MessageResponseDto })
  resendOtp(@Body() dto: ResendRegistrationOtpDto): Promise<MessageResponseDto> {
    return this.authService.resendRegistrationOtp(dto);
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the email OTP to activate the account' })
  @ApiBody({ type: VerifyRegistrationOtpDto })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired OTP' })
  verifyOtp(@Body() dto: VerifyRegistrationOtpDto): Promise<MessageResponseDto> {
    return this.authService.verifyRegistrationOtp(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtain a new access token using a refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const payload = await this.authService.refresh(dto);
    this.setAuthCookies(res, payload);
    return payload;
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an OTP to reset the account password' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({ type: MessageResponseDto, description: 'OTP dispatched if the account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    await this.authService.forgotPassword(dto);
    return { message: 'OTP has been sent to the registered email.' };
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset the password using an OTP' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired OTP' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    await this.authService.resetPassword(dto);
    return { message: 'Password has been reset successfully.' };
  }

  @Patch('change-password')
  @ApiBearerAuth()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Update the authenticated user password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Current password is incorrect' })
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto): Promise<MessageResponseDto> {
    const user = req['user'] as UserEntity;
    await this.authService.changePassword(user.id, dto);
    return { message: 'Password updated successfully.' };
  }

  @Post('logout')
  @ApiBearerAuth()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Revoke refresh tokens for the authenticated user' })
  @ApiBody({ type: LogoutDto, required: false })
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(
    @Req() req: Request,
    @Body() dto: LogoutDto | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const user = req['user'] as UserEntity;
    await this.authService.logout(user.id, dto);
    this.clearAuthCookies(res);
    return { message: 'Refresh tokens revoked.' };
  }

  private setAuthCookies(res: Response, payload: AuthResponseDto): void {
    const accessTokenCookieName =
      this.configService.get<string>('auth.accessTokenCookieName') ?? 'qedu_access_token';
    const refreshTokenCookieName =
      this.configService.get<string>('auth.refreshTokenCookieName') ?? 'qedu_refresh_token';

    const accessTokenMaxAge = this.authService.getAccessTokenTtlMs();
    const refreshTokenMaxAge = this.authService.getRefreshTokenTtlMs();

    res.cookie(accessTokenCookieName, payload.accessToken, this.buildCookieOptions(accessTokenMaxAge));
    res.cookie(
      refreshTokenCookieName,
      payload.refreshToken,
      this.buildCookieOptions(refreshTokenMaxAge),
    );
  }

  private clearAuthCookies(res: Response): void {
    const accessTokenCookieName =
      this.configService.get<string>('auth.accessTokenCookieName') ?? 'qedu_access_token';
    const refreshTokenCookieName =
      this.configService.get<string>('auth.refreshTokenCookieName') ?? 'qedu_refresh_token';

    const baseOptions = this.buildCookieOptions(0);
    res.clearCookie(accessTokenCookieName, baseOptions);
    res.clearCookie(refreshTokenCookieName, baseOptions);
  }

  private buildCookieOptions(maxAge: number): CookieOptions {
    const secure = this.configService.get<boolean>('auth.cookieSecure') ?? true;
    const sameSite = (this.configService.get<string>('auth.cookieSameSite') ?? 'lax') as
      | CookieOptions['sameSite'];
    const domain = this.configService.get<string | undefined>('auth.cookieDomain') ?? undefined;

    const options: CookieOptions = {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      path: '/',
    };

    if (Number.isFinite(maxAge) && maxAge > 0) {
      options.maxAge = maxAge;
    } else {
      options.expires = new Date(0);
    }

    return options;
  }
}

