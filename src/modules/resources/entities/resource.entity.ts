import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceVisibility } from '@prisma/client';

export class ResourceEntity {
  constructor(partial: Partial<ResourceEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  fileUrl!: string;

  @ApiPropertyOptional()
  fileKey?: string | null;

  @ApiPropertyOptional()
  mimeType?: string | null;

  @ApiPropertyOptional()
  fileType?: string | null;

  @ApiPropertyOptional()
  fileSize?: number | null;

  @ApiProperty()
  visibility!: ResourceVisibility;

  @ApiPropertyOptional()
  classId?: string | null;

  @ApiPropertyOptional()
  classTitle?: string | null;

  @ApiProperty()
  uploaderId!: string;

  @ApiPropertyOptional()
  uploaderName?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown> | null;
}
