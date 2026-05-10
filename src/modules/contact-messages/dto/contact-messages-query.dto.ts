import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContactMessageStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ContactMessagesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ContactMessageStatus })
  @IsOptional()
  @IsEnum(ContactMessageStatus)
  status?: ContactMessageStatus;

  @ApiPropertyOptional({ description: 'Search by sender name, email, subject, or body' })
  @IsOptional()
  @IsString()
  search?: string;
}
