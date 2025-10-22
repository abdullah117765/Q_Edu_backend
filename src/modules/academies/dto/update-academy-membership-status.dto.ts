import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

export enum AcademyMembershipAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REVOKE = 'REVOKE',
}

export class UpdateAcademyMembershipStatusDto {
  @ApiProperty({ enum: AcademyMembershipAction })
  @IsEnum(AcademyMembershipAction)
  action!: AcademyMembershipAction;

  @ApiPropertyOptional({
    description: 'Reason is required when rejecting or revoking a membership',
    minLength: 3,
    maxLength: 512,
  })
  @ValidateIf((dto) => dto.action === AcademyMembershipAction.REJECT || dto.action === AcademyMembershipAction.REVOKE)
  @IsString()
  @Length(3, 512)
  reason?: string;
}
