import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../entities/user.entity';

class PaginationMetaDto {
  @ApiProperty({ description: 'Total number of records available' })
  total!: number;

  @ApiProperty({ description: 'Number of records returned in this page' })
  count!: number;

  @ApiProperty({ nullable: true, description: 'Next page number if available' })
  nextPage!: number | null;

  @ApiProperty({ nullable: true, description: 'Previous page number if available' })
  previousPage!: number | null;

  @ApiProperty({ description: 'Current page number' })
  currentPage!: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages!: number;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: () => [UserEntity] })
  data!: UserEntity[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}