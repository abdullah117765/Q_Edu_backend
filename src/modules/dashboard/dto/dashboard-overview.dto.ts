import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DashboardAcademyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  ownerName!: string;

  @ApiProperty()
  ownerEmail!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

class DashboardRoleTotalsDto {
  @ApiProperty()
  approved!: number;

  @ApiProperty()
  pending!: number;
}

class DashboardClassTotalsDto {
  @ApiProperty()
  upcoming!: number;

  @ApiProperty()
  ongoing!: number;

  @ApiProperty()
  completedLast30Days!: number;
}

class DashboardTotalsDto {
  @ApiProperty({ type: () => DashboardRoleTotalsDto })
  teachers!: DashboardRoleTotalsDto;

  @ApiProperty({ type: () => DashboardRoleTotalsDto })
  students!: DashboardRoleTotalsDto;

  @ApiProperty({ type: () => DashboardClassTotalsDto })
  classes!: DashboardClassTotalsDto;
}

class DashboardClassTeacherDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiProperty()
  email!: string;
}

class DashboardClassSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ type: () => DashboardClassTeacherDto, nullable: true })
  teacher!: DashboardClassTeacherDto | null;

  @ApiProperty()
  scheduledStart!: Date;

  @ApiProperty()
  scheduledEnd!: Date;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  participantsCount!: number;

  @ApiPropertyOptional()
  zoomJoinUrl?: string | null;
}

class DashboardSubscriptionLimitsDto {
  @ApiProperty()
  students!: number;

  @ApiProperty()
  teachers!: number;

  @ApiProperty()
  storageGb!: number;
}

class DashboardSubscriptionUsageDto {
  @ApiProperty()
  students!: number;

  @ApiProperty()
  teachers!: number;

  @ApiProperty()
  storageGb!: number;
}

class DashboardSubscriptionDto {
  @ApiProperty()
  plan!: string;

  @ApiProperty({ type: () => DashboardSubscriptionLimitsDto })
  limits!: DashboardSubscriptionLimitsDto;

  @ApiProperty({ type: () => DashboardSubscriptionUsageDto })
  usage!: DashboardSubscriptionUsageDto;
}

class DashboardZoomTransactionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  timestamp!: Date;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  summary!: string;
}

class DashboardZoomCreditsDto {
  @ApiProperty()
  balance!: number;

  @ApiProperty()
  totalCredited!: number;

  @ApiProperty()
  totalDebited!: number;

  @ApiProperty({ type: () => [DashboardZoomTransactionDto] })
  recentTransactions!: DashboardZoomTransactionDto[];
}

class DashboardActivityDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  timestamp!: Date;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  message!: string;
}

export class DashboardOverviewDto {
  @ApiProperty({ type: () => DashboardAcademyDto })
  academy!: DashboardAcademyDto;

  @ApiProperty({ type: () => DashboardTotalsDto })
  totals!: DashboardTotalsDto;

  @ApiProperty({ type: () => [DashboardClassSummaryDto] })
  upcomingClasses!: DashboardClassSummaryDto[];

  @ApiProperty({ type: () => DashboardSubscriptionDto })
  subscription!: DashboardSubscriptionDto;

  @ApiProperty({ type: () => DashboardZoomCreditsDto })
  zoomCredits!: DashboardZoomCreditsDto;

  @ApiProperty({ type: () => [DashboardActivityDto] })
  recentActivity!: DashboardActivityDto[];
}
