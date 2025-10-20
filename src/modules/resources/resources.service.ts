import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResourceVisibility } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ResourceEntity } from './entities/resource.entity';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourcesQueryDto } from './dto/resources-query.dto';
import { PaginatedResourcesResponseDto } from './dto/paginated-resources-response.dto';

type ResourceWithRelations = {
  id: string;
  title: string;
  description: string | null;
  fileKey: string;
  fileUrl: string;
  mimeType: string | null;
  fileType: string | null;
  fileSize: number | null;
  classId: string | null;
  visibility: ResourceVisibility;
  metadata: Prisma.JsonValue | null;
  uploaderId: string;
  createdAt: Date;
  updatedAt: Date;
  uploader: {
    firstName: string;
    lastName: string | null;
    email: string;
  };
  class: {
    id: string;
    title: string;
  } | null;
};

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(uploaderId: string, dto: CreateResourceDto): Promise<ResourceEntity> {
    const resource = await this.prisma.resource.create({
      data: {
        title: dto.title,
        description: dto.description,
        fileKey: dto.fileKey,
        fileUrl: dto.fileUrl,
        mimeType: dto.mimeType,
        fileType: dto.fileType,
        fileSize: dto.fileSize,
        classId: dto.classId,
        visibility: dto.visibility ?? ResourceVisibility.ACADEMY,
        metadata: this.toInputJson(dto.metadata),
        uploaderId,
      },
      include: {
        uploader: { select: { firstName: true, lastName: true, email: true } },
        class: { select: { id: true, title: true } },
      },
    });

    return this.toEntity(resource);
  }

  async findAll(query: ResourcesQueryDto, uploaderId?: string): Promise<PaginatedResourcesResponseDto> {
    const where: Prisma.ResourceWhereInput = {
      ...(query.type ? { fileType: query.type } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.uploaderId ? { uploaderId: query.uploaderId } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
    };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (!query.visibility && !query.uploaderId && uploaderId) {
      where.OR = [
        ...(where.OR ?? []),
        { uploaderId },
        { visibility: ResourceVisibility.ACADEMY },
        { visibility: ResourceVisibility.PUBLIC },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [total, resources] = await this.prisma.$transaction([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        include: {
          uploader: { select: { firstName: true, lastName: true, email: true } },
          class: { select: { id: true, title: true } },
        },
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      data: resources.map((resource) => this.toEntity(resource)),
      meta: {
        total,
        count: resources.length,
        currentPage: query.page,
        totalPages,
        nextPage: query.page < totalPages ? query.page + 1 : null,
        previousPage: query.page > 1 ? query.page - 1 : null,
      },
    };
  }

  async findOne(id: string): Promise<ResourceEntity> {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        uploader: { select: { firstName: true, lastName: true, email: true } },
        class: { select: { id: true, title: true } },
      },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found.');
    }

    return this.toEntity(resource);
  }

  async update(id: string, dto: UpdateResourceDto): Promise<ResourceEntity> {
    const resource = await this.prisma.resource.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        fileUrl: dto.fileUrl,
        fileKey: dto.fileKey,
        mimeType: dto.mimeType,
        fileType: dto.fileType,
        fileSize: dto.fileSize,
        classId: dto.classId,
        visibility: dto.visibility,
        metadata: this.toInputJson(dto.metadata),
      },
      include: {
        uploader: { select: { firstName: true, lastName: true, email: true } },
        class: { select: { id: true, title: true } },
      },
    });

    return this.toEntity(resource);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Resource not found.');
    }

    await this.prisma.resource.delete({ where: { id } });
  }

  private toEntity(resource: ResourceWithRelations): ResourceEntity {
    return new ResourceEntity({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      fileUrl: resource.fileUrl,
      fileKey: resource.fileKey,
      mimeType: resource.mimeType,
      fileType: resource.fileType,
      fileSize: resource.fileSize,
      visibility: resource.visibility,
      classId: resource.classId,
      classTitle: resource.class?.title ?? null,
      uploaderId: resource.uploaderId,
      uploaderName:
        [resource.uploader.firstName, resource.uploader.lastName].filter(Boolean).join(' ') ||
        resource.uploader.email,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      metadata: this.toPlainMetadata(resource.metadata),
    });
  }

  private toInputJson(value?: Record<string, unknown> | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private toPlainMetadata(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
