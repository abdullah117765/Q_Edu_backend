import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly logger = new Logger(MailService.name);
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.getOrThrow<string>('email.host');
    const port = this.configService.getOrThrow<number>('email.port');
    const user = this.configService.getOrThrow<string>('email.user');
    const pass = this.configService.getOrThrow<string>('email.password');
    this.fromAddress = this.configService.getOrThrow<string>('email.from');
    const secure = this.configService.get<boolean>('email.secure') ?? false;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendMail(options: MailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        ...options,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  async sendPasswordResetOtp(to: string, otp: string): Promise<void> {
    const subject = 'Password Reset Request';
    const html = `
      <p>Hello,</p>
      <p>Your one-time password (OTP) for resetting your account is:</p>
      <p style="font-size: 24px; font-weight: bold;">${otp}</p>
      <p>This code will expire in 10 minutes. If you did not request a password reset, please ignore this email.</p>
      <p>Regards,<br/>Q Edu Team</p>
    `;

    await this.sendMail({ to, subject, html });
  }

  async sendRegistrationOtp(to: string, otp: string): Promise<void> {
    const subject = 'Verify your Q Edu account';
    const html = `
      <p>Welcome to Q Edu!</p>
      <p>Your verification code is:</p>
      <p style="font-size: 24px; font-weight: bold;">${otp}</p>
      <p>This code will expire in 10 minutes. Enter it in the application to activate your account.</p>
      <p>If you did not initiate this registration, please ignore this email.</p>
      <p>Regards,<br/>Q Edu Team</p>
    `;

    await this.sendMail({ to, subject, html });
  }
}