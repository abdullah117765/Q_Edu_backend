import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RequestAcademyMembershipDto {
  @ApiProperty({ description: 'Identifier of the academy to join' })
  @IsString()
  academyId!: string;
}
