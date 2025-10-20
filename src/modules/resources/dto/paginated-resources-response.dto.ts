import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/interfaces/pagination.interface';
import { ResourceEntity } from '../entities/resource.entity';

class ResourcesPaginationMeta implements PaginationMeta {
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

export class PaginatedResourcesResponseDto {
  @ApiProperty({ type: () => [ResourceEntity] })
  data!: ResourceEntity[];

  @ApiProperty({ type: () => ResourcesPaginationMeta })
  meta!: ResourcesPaginationMeta;
}
