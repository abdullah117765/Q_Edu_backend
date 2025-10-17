import { Injectable } from '@nestjs/common';
import { ClassStatus, Role as PrismaRole, UserStatus, ZoomCreditTransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomCreditsService } from '../zoom-credits/zoom-credits.service';
import { ZoomCreditTransactionsQueryDto } from '../zoom-credits/dto/zoom-credit-transactions-query.dto';
import { DashboardOverviewDto } from './dto/dashboard-overview.dto';
import { UserEntity } from '../users/entities/user.entity';
import { ZoomCreditTransactionEntity } from '../zoom-credits/entities/zoom-credit-transaction.entity';

const DEFAULT_PLAN_NAME = 'Professional';
const DEFAULT_STUDENT_LIMIT = 200;
const DEFAULT_TEACHER_LIMIT = 25;
const DEFAULT_STORAGE_LIMIT_GB = 100;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomCreditsService: ZoomCreditsService,
  ) {}

  async getOverview(user: UserEntity): Promise<DashboardOverviewDto> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      approvedTeachers,
      pendingTeachers,
      approvedStudents,
      pendingStudents,
      upcomingClassesCount,
      ongoingClassesCount,
      completedClassesLast30,
      upcomingClasses,
      recentClasses,
      recentApprovedUsers,
      zoomSummary,
      zoomTransactions,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: PrismaRole.TEACHER, status: UserStatus.APPROVED } }),
      this.prisma.user.count({ where: { role: PrismaRole.TEACHER, status: UserStatus.PENDING } }),
      this.prisma.user.count({ where: { role: PrismaRole.STUDENT, status: UserStatus.APPROVED } }),
      this.prisma.user.count({ where: { role: PrismaRole.STUDENT, status: UserStatus.PENDING } }),
      this.prisma.class.count({
        where: {
          status: ClassStatus.UPCOMING,
          scheduledStart: { gte: now },
        },
      }),
      this.prisma.class.count({
        where: {
          status: ClassStatus.ONGOING,
        },
      }),
      this.prisma.class.count({
        where: {
          status: ClassStatus.ENDED,
          scheduledEnd: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.class.findMany({
        where: {
          status: ClassStatus.UPCOMING,
          scheduledStart: { gte: now },
        },
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: { participants: true },
          },
        },
        orderBy: { scheduledStart: 'asc' },
        take: 5,
      }),
      this.prisma.class.findMany({
        select: {
          id: true,
          title: true,
          scheduledStart: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.user.findMany({
        where: { status: UserStatus.APPROVED },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.zoomCreditsService.getSummary(user.id),
      this.zoomCreditsService.getTransactions(
        user.id,
        Object.assign(new ZoomCreditTransactionsQueryDto(), { page: 1, limit: 5 }),
      ),
    ]);

    const upcomingClassSummaries = upcomingClasses.map((record) => ({
      id: record.id,
      title: record.title,
      description: record.description ?? null,
      teacher: record.teacher
        ? {
            id: record.teacher.id,
            firstName: record.teacher.firstName,
            lastName: record.teacher.lastName,
            email: record.teacher.email,
            name: this.buildDisplayName(record.teacher.firstName, record.teacher.lastName, record.teacher.email),
          }
        : null,
      scheduledStart: record.scheduledStart,
      scheduledEnd: record.scheduledEnd,
      timezone: record.timezone,
      status: record.status,
      participantsCount: record._count?.participants ?? 0,
      zoomJoinUrl: record.zoomJoinUrl ?? null,
    }));

    const recentTransactions = zoomTransactions.data.map((tx) => {
      const metadataTitle =
        tx.metadata && typeof tx.metadata['classTitle'] === 'string' ? (tx.metadata['classTitle'] as string) : undefined;
      return {
        id: tx.id,
        timestamp: tx.createdAt,
        type: tx.type,
        amount: tx.amount,
        summary: tx.reason ?? metadataTitle ?? 'Zoom credit activity',
      };
    });

    const subscriptionUsage = {
      students: approvedStudents,
      teachers: approvedTeachers,
      storageGb: Math.min(DEFAULT_STORAGE_LIMIT_GB, Math.round(approvedStudents * 0.5)),
    };

    const recentActivity = this.composeRecentActivity(
      recentClasses,
      recentApprovedUsers,
      zoomTransactions.data,
    );

    return {
      academy: {
        id: user.id,
        name: this.deriveAcademyName(user),
        ownerName: this.buildDisplayName(user.firstName, user.lastName, user.email),
        ownerEmail: user.email,
        createdAt: user.createdAt,
        updatedAt: now,
      },
      totals: {
        teachers: {
          approved: approvedTeachers,
          pending: pendingTeachers,
        },
        students: {
          approved: approvedStudents,
          pending: pendingStudents,
        },
        classes: {
          upcoming: upcomingClassesCount,
          ongoing: ongoingClassesCount,
          completedLast30Days: completedClassesLast30,
        },
      },
      upcomingClasses: upcomingClassSummaries,
      subscription: {
        plan: DEFAULT_PLAN_NAME,
        limits: {
          students: DEFAULT_STUDENT_LIMIT,
          teachers: DEFAULT_TEACHER_LIMIT,
          storageGb: DEFAULT_STORAGE_LIMIT_GB,
        },
        usage: subscriptionUsage,
      },
      zoomCredits: {
        balance: zoomSummary.balance,
        totalCredited: zoomSummary.totalCredited,
        totalDebited: zoomSummary.totalDebited,
        recentTransactions,
      },
      recentActivity,
    };
  }

  private buildDisplayName(firstName?: string | null, lastName?: string | null, fallbackEmail?: string): string {
    const name = [firstName ?? '', lastName ?? ''].map((part) => part.trim()).filter(Boolean).join(' ');
    return name || fallbackEmail || 'Unnamed';
  }

  private deriveAcademyName(user: UserEntity): string {
    const ownerName = this.buildDisplayName(user.firstName, user.lastName, user.email);
    return ownerName ? `${ownerName}'s Academy` : 'Your Academy';
  }

  private composeRecentActivity(
    classes: Array<{ id: string; title: string; scheduledStart: Date; createdAt: Date }>,
    approvedUsers: Array<{ id: string; firstName: string | null; lastName: string | null; email: string; role: PrismaRole; updatedAt: Date }>,
    transactions: ZoomCreditTransactionEntity[],
  ) {
    const classActivities = classes.map((cls) => ({
      id: `class:${cls.id}`,
      timestamp: cls.createdAt,
      type: 'class_scheduled',
      message: `Scheduled “${cls.title}” for ${cls.scheduledStart.toISOString()}.`,
    }));

    const userActivities = approvedUsers.map((user) => ({
      id: `user:${user.id}:${user.updatedAt.getTime()}`,
      timestamp: user.updatedAt,
      type: 'user_approved',
      message: `Approved ${this.buildDisplayName(user.firstName, user.lastName, user.email)} as ${user.role}.`,
    }));

    const transactionActivities = transactions.map((tx) => {
      const isCredit = tx.type === ZoomCreditTransactionType.CREDIT || tx.type === ZoomCreditTransactionType.TRANSFER_IN;
      const metadataTitle =
        tx.metadata && typeof tx.metadata['classTitle'] === 'string' ? (tx.metadata['classTitle'] as string) : undefined;
      const action = isCredit ? 'Credited' : 'Debited';
      const summary = tx.reason ?? metadataTitle ?? 'Zoom credit activity';
      return {
        id: `credit:${tx.id}`,
        timestamp: tx.createdAt,
        type: 'credit_transaction',
        message: `${action} ${tx.amount} credits – ${summary}.`,
      };
    });

    return [...classActivities, ...userActivities, ...transactionActivities]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }
}
