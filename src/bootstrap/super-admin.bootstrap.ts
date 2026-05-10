import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

interface SuperAdminConfig {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const SALT_ROUNDS = 12;

@Injectable()
export class SuperAdminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminBootstrap.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const cfg = this.config.get<SuperAdminConfig>('superAdmin');
    if (!cfg?.email || !cfg?.password) {
      this.logger.warn(
        'SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set - skipping super admin bootstrap.',
      );
      return;
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: cfg.email },
      select: { id: true, role: true, status: true, isActive: true },
    });

    if (!existing) {
      const hash = await bcrypt.hash(cfg.password, SALT_ROUNDS);
      await this.prisma.user.create({
        data: {
          email: cfg.email,
          password: hash,
          firstName: cfg.firstName,
          lastName: cfg.lastName,
          phoneNumber: '',
          role: Role.SUPER_ADMIN,
          status: UserStatus.APPROVED,
          isActive: true,
        },
      });
      this.logger.log(`Created super admin user ${cfg.email}.`);
      return;
    }

    // Ensure existing account stays in the right state.
    if (
      existing.role !== Role.SUPER_ADMIN ||
      existing.status !== UserStatus.APPROVED ||
      !existing.isActive
    ) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          role: Role.SUPER_ADMIN,
          status: UserStatus.APPROVED,
          isActive: true,
        },
      });
      this.logger.log(
        `Promoted existing user ${cfg.email} to active super admin.`,
      );
    } else {
      this.logger.log(`Super admin ${cfg.email} present - no changes.`);
    }
  }
}
