import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { Role } from '../users/entities/role.enum';
import { AcademiesService } from '../academies/academies.service';
import { AcademySettingsEntity } from './entities/academy-settings.entity';
import { UpdateAcademySettingsDto } from './dto/update-academy-settings.dto';
import { AcademySettingsService } from './academy-settings.service';

type RequestWithUser = Request & { user?: { id?: string } };

@ApiTags('academy-settings')
@ApiBearerAuth()
@Controller('academy-settings')
export class AcademySettingsController {
  constructor(
    private readonly academySettingsService: AcademySettingsService,
    private readonly academiesService: AcademiesService,
  ) {}

  @Get()
  @Auth(Role.ACADEMY_OWNER)
  @ApiOperation({
    summary: 'Retrieve academy-specific settings for the authenticated owner',
  })
  @ApiOkResponse({ type: AcademySettingsEntity })
  async getSettings(
    @Req() request: RequestWithUser,
  ): Promise<AcademySettingsEntity> {
    const ownerId = request.user?.id;
    await this.academiesService.ensureOwnerAcademyApproved(ownerId as string);
    return this.academySettingsService.getSettings(ownerId as string);
  }

  @Patch()
  @Auth(Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Update academy-specific settings' })
  @ApiOkResponse({ type: AcademySettingsEntity })
  async updateSettings(
    @Req() request: RequestWithUser,
    @Body() dto: UpdateAcademySettingsDto,
  ): Promise<AcademySettingsEntity> {
    const ownerId = request.user?.id;
    await this.academiesService.ensureOwnerAcademyApproved(ownerId as string);
    return this.academySettingsService.updateSettings(ownerId as string, dto);
  }
}
