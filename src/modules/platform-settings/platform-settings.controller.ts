import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { UserEntity } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.enum';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PlatformSettingsEntity } from './entities/platform-settings.entity';
import { PlatformSettingsService } from './platform-settings.service';

type RequestWithUser = Request & { user?: UserEntity };

@ApiTags('platform-settings')
@ApiBearerAuth()
@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  @Get()
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Retrieve current platform settings' })
  @ApiOkResponse({ type: PlatformSettingsEntity })
  async getSettings(): Promise<PlatformSettingsEntity> {
    return this.platformSettingsService.getSettings();
  }

  @Patch()
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update platform settings' })
  @ApiOkResponse({ type: PlatformSettingsEntity })
  async updateSettings(
    @Body() dto: UpdatePlatformSettingsDto,
    @Req() request: RequestWithUser,
  ): Promise<PlatformSettingsEntity> {
    const userId = request.user?.id ?? null;
    return this.platformSettingsService.updateSettings(dto, userId);
  }
}
