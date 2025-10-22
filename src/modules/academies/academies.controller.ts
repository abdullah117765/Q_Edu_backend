import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { AcademyDirectoryQueryDto } from './dto/academy-directory-query.dto';
import { AcademyMembershipQueryDto } from './dto/academy-membership-query.dto';
import { RequestAcademyMembershipDto } from './dto/request-academy-membership.dto';
import { UpdateAcademyMembershipStatusDto } from './dto/update-academy-membership-status.dto';
import { AcademiesService } from './academies.service';
import { AcademyDetailEntity, AcademyMembershipEntity, AcademySummaryEntity } from './entities/academy.entity';
import { Role } from '../users/entities/role.enum';
import { UserEntity } from '../users/entities/user.entity';

@ApiTags('academies')
@ApiBearerAuth()
@Controller('academies')
export class AcademiesController {
  constructor(private readonly academiesService: AcademiesService) {}

  @Get()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Browse academy directory' })
  @ApiOkResponse({ description: 'Paginated list of academies returned.' })
  async listDirectory(@Query() query: AcademyDirectoryQueryDto) {
    return this.academiesService.listDirectory(query);
  }

  @Get('owner')
  @Auth(Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Retrieve academy details for the current owner' })
  @ApiOkResponse({ type: AcademyDetailEntity })
  @ApiNotFoundResponse({ description: 'No academy associated with the current owner.' })
  getCurrentOwnerAcademy(@Req() request: Request) {
    const currentUser = request['user'] as UserEntity;
    return this.academiesService.getAcademyForOwner(currentUser.id);
  }

  @Get('owner/memberships')
  @Auth(Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'List membership requests for the owner academy' })
  @ApiOkResponse({ description: 'Paginated membership list returned.' })
  listOwnerMemberships(@Req() request: Request, @Query() query: AcademyMembershipQueryDto) {
    const currentUser = request['user'] as UserEntity;
    return this.academiesService.listMembershipsForOwner(currentUser.id, query);
  }

  @Get('memberships')
  @Auth(Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'List academy memberships for the current user' })
  @ApiOkResponse({ description: 'Paginated membership list returned.' })
  listMyMemberships(@Req() request: Request, @Query() query: AcademyMembershipQueryDto) {
    const currentUser = request['user'] as UserEntity;
    return this.academiesService.listMembershipsForUser(currentUser.id, query);
  }

  @Post('memberships')
  @Auth(Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Request to join an academy' })
  @ApiCreatedResponse({ type: AcademyMembershipEntity })
  @ApiNotFoundResponse({ description: 'Academy not found.' })
  @ApiForbiddenResponse({ description: 'Action not permitted for your account state.' })
  requestMembership(@Req() request: Request, @Body() dto: RequestAcademyMembershipDto) {
    const currentUser = request['user'] as UserEntity;
    return this.academiesService.requestMembership(currentUser.id, dto.academyId);
  }

  @Patch('memberships/:membershipId')
  @Auth(Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Update a membership request status' })
  @ApiParam({ name: 'membershipId', description: 'Membership identifier' })
  @ApiOkResponse({ type: AcademyMembershipEntity })
  @ApiNotFoundResponse({ description: 'Membership record not found.' })
  @ApiBadRequestResponse({ description: 'Invalid status transition or missing reason.' })
  @ApiForbiddenResponse({ description: 'You can only manage memberships for your own academy.' })
  updateMembershipStatus(
    @Req() request: Request,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateAcademyMembershipStatusDto,
  ) {
    const currentUser = request['user'] as UserEntity;
    return this.academiesService.updateMembershipStatus(currentUser.id, membershipId, dto);
  }
}
