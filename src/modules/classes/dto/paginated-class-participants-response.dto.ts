import { ApiProperty } from '@nestjs/swagger';
import { ClassParticipantEntity } from '../entities/class-participant.entity';

class PaginationMetaDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  count!: number;

  @ApiProperty()
  currentPage!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty({ nullable: true })
  nextPage!: number | null;

  @ApiProperty({ nullable: true })
  previousPage!: number | null;
}

export class PaginatedClassParticipantsResponseDto {
  @ApiProperty({ type: () => [ClassParticipantEntity] })
  data!: ClassParticipantEntity[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
