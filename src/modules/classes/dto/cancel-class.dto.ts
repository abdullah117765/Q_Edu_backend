import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CancelClassDto {
  @ApiProperty({
    description: 'Reason shown in class metadata when a scheduled class is cancelled',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 500)
  reason!: string;
}
