import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AcademyStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

export class UpdateAcademyReviewDto {
  @ApiProperty({
    enum: AcademyStatus,
    description: 'Approval status to apply to the academy profile',
  })
  @IsEnum(AcademyStatus)
  status!: AcademyStatus;

  @ApiPropertyOptional({
    description: 'Reason shared with the owner when the academy is rejected',
    minLength: 10,
    maxLength: 512,
  })
  @ValidateIf((dto) => dto.status === AcademyStatus.REJECTED)
  @IsString()
  @Length(10, 512)
  reason?: string;
}
