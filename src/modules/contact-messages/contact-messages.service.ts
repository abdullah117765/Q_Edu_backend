import { Injectable, NotFoundException } from '@nestjs/common';
import { ContactMessageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactMessagesQueryDto } from './dto/contact-messages-query.dto';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { UpdateContactMessageStatusDto } from './dto/update-contact-message-status.dto';

@Injectable()
export class ContactMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateContactMessageDto) {
    return this.prisma.contactMessage.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        subject: dto.subject?.trim() || null,
        message: dto.message.trim(),
        sourceUrl: dto.sourceUrl?.trim() || null,
      },
    });
  }

  async list(query: ContactMessagesQueryDto) {
    const where: Prisma.ContactMessageWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { subject: { contains: search } },
        { message: { contains: search } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.contactMessage.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      data: items,
      meta: {
        total,
        count: items.length,
        nextPage: query.page < totalPages ? query.page + 1 : null,
        previousPage: query.page > 1 ? query.page - 1 : null,
        currentPage: query.page,
        totalPages,
      },
    };
  }

  async updateStatus(
    id: string,
    dto: UpdateContactMessageStatusDto,
    actorId: string,
  ) {
    const existing = await this.prisma.contactMessage.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Contact message not found.');
    }

    const currentMeta =
      existing.metadata &&
      typeof existing.metadata === 'object' &&
      !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};

    return this.prisma.contactMessage.update({
      where: { id },
      data: {
        status: dto.status,
        metadata: {
          ...currentMeta,
          triage: {
            status: dto.status,
            note: dto.note ?? null,
            actorId,
            at: new Date().toISOString(),
          },
        },
      },
    });
  }

  markReviewed(id: string, actorId: string) {
    return this.updateStatus(
      id,
      { status: ContactMessageStatus.IN_REVIEW },
      actorId,
    );
  }
}
