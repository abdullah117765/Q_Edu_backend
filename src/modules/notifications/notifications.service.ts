import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

export interface NotifyOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Prisma.InputJsonValue;
  email?: { to: string; subject: string; html: string };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async notify(options: NotifyOptions): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: options.userId,
        type: options.type,
        title: options.title,
        body: options.body ?? null,
        data: options.data ?? Prisma.JsonNull,
      },
    });

    if (options.email) {
      this.mail
        .sendMail(options.email)
        .catch((err) =>
          this.logger.warn(`Notification email failed: ${err?.message ?? err}`),
        );
    }

    return notification;
  }

  async notifyMany(userIds: string[], base: Omit<NotifyOptions, 'userId'>) {
    await Promise.all(
      userIds.map((userId) => this.notify({ ...base, userId })),
    );
  }

  async list(
    userId: string,
    params: { unreadOnly?: boolean; take?: number; skip?: number } = {},
  ) {
    const take = Math.min(Math.max(params.take ?? 20, 1), 100);
    const skip = Math.max(params.skip ?? 0, 0);
    const where: Prisma.NotificationWhereInput = { userId };
    if (params.unreadOnly) where.readAt = null;

    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { items, total, unread, take, skip };
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    if (existing.readAt) return existing;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
