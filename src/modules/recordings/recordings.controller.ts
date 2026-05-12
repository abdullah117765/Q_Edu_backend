import {
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    Logger,
    Post,
    Query,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ApiExcludeEndpoint,
    ApiOperation,
    ApiTags
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { Role } from '../users/entities/role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { RecordingsQueryDto } from './dto/recordings-query.dto';
import { RecordingsService } from './recordings.service';

type RequestWithUser = Request & { user?: UserEntity };

@ApiTags('recordings')
@Controller('recordings')
export class RecordingsController {
  private readonly logger = new Logger(RecordingsController.name);
  private readonly zoomVerificationToken: string;

  constructor(
    private readonly recordingsService: RecordingsService,
    private readonly configService: ConfigService,
  ) {
    this.zoomVerificationToken =
      this.configService.get<string>('zoom.webhookVerificationToken') ?? '';
  }

  // ─── Super-admin: all recordings ──────────────────────────────────────────
  @Get()
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all recordings (super-admin)' })
  async findAll(@Query() query: RecordingsQueryDto) {
    return this.recordingsService.findAll(query);
  }

  // ─── Academy owner: their own academy's recordings ────────────────────────
  @Get('my')
  @Auth(Role.ACADEMY_OWNER)
  @ApiOperation({ summary: "List own academy's recordings" })
  async findMine(
    @Req() req: RequestWithUser,
    @Query() query: RecordingsQueryDto,
  ) {
    const userId = req.user!.id;
    return this.recordingsService.findForAcademy(userId, query);
  }

  // ─── Manual recording entry (local recordings / overrides) ─────────────────
  @Post()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Manually register a recording URL for a class' })
  async create(@Req() req: RequestWithUser, @Body() dto: CreateRecordingDto) {
    const user = req.user!;
    return this.recordingsService.create(user.id, user.role, dto);
  }

  // ─── Zoom webhook: recording.completed ────────────────────────────────────
  @Post('webhook/zoom')
  @SkipThrottle()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async zoomWebhook(
    @Headers('authorization') authorization: string,
    @Body() body: any,
  ) {
    // Zoom URL validation challenge (required when registering the webhook)
    if (body?.event === 'endpoint.url_validation') {
      const plainToken = body?.payload?.plainToken ?? '';
      this.logger.log('Zoom webhook URL validation challenge received');
      // Return as Zoom expects — no signature verification needed for this event
      return { plainToken, encryptedToken: plainToken };
    }

    // Verify Zoom's verification token if configured
    if (this.zoomVerificationToken) {
      const token = authorization?.replace(/^Bearer\s+/i, '').trim();
      if (token !== this.zoomVerificationToken) {
        this.logger.warn('Zoom webhook: invalid verification token');
        throw new UnauthorizedException('Invalid Zoom verification token');
      }
    }

    if (body?.event === 'recording.completed') {
      this.logger.log(
        `Zoom recording.completed webhook received for meeting ${body?.payload?.object?.id}`,
      );
      await this.recordingsService.handleZoomRecordingCompleted(body);
    }

    return { received: true };
  }
}
