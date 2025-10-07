import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ClassStatus } from '../entities/class-status.enum';
import { CreateClassDto } from './create-class.dto';

export class UpdateClassDto extends PartialType(CreateClassDto) {
  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;
}
