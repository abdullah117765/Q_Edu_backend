import { ApiProperty } from '@nestjs/swagger';
import { ClassEntity } from '../entities/class.entity';

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

export class PaginatedClassesResponseDto {
  @ApiProperty({ type: () => [ClassEntity] })
  data!: ClassEntity[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
