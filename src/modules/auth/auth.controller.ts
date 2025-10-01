import { Body, Controller, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
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
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or account not approved' })
  login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  register(@Body() createUserDto: CreateUserDto): Promise<MessageResponseDto> {
    return this.authService.register(createUserDto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the email verification OTP' })
  @ApiBody({ type: ResendRegistrationOtpDto })
  @ApiOkResponse({ type: MessageResponseDto })
  resendOtp(@Body() dto: ResendRegistrationOtpDto): Promise<MessageResponseDto> {
    return this.authService.resendRegistrationOtp(dto);
  }

  @Post('verify-otp')
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
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an OTP to reset the account password' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({ type: MessageResponseDto, description: 'OTP dispatched if the account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    await this.authService.forgotPassword(dto);
    return { message: 'If the account exists, an OTP has been sent to the registered email.' };
  }

  @Post('reset-password')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update the authenticated user password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiNoContentResponse({ description: 'Password updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Current password is incorrect' })
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto): Promise<void> {
    const user = req['user'] as UserEntity;
    await this.authService.changePassword(user.id, dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke refresh tokens for the authenticated user' })
  @ApiBody({ type: LogoutDto, required: false })
  @ApiNoContentResponse({ description: 'Refresh tokens revoked' })
  async logout(@Req() req: Request, @Body() dto?: LogoutDto): Promise<void> {
    const user = req['user'] as UserEntity;
    await this.authService.logout(user.id, dto);
  }
}
