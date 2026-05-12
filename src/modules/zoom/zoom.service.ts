import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, isAxiosError } from 'axios';
import {
  CreateZoomMeetingPayload,
  UpdateZoomMeetingPayload,
  ZoomMeetingResponse,
  ZoomParticipantsResponse,
} from './interfaces/zoom.interface';

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private readonly http: AxiosInstance;
  private readonly accountId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly oauthUrl: string;
  private readonly enabled: boolean;
  private tokenCache: CachedToken | null = null;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = configService.get<string>('zoom.apiBaseUrl') ?? 'https://api.zoom.us/v2';
    this.accountId = (configService.get<string>('zoom.accountId') ?? '').trim();
    this.clientId = (configService.get<string>('zoom.clientId') ?? '').trim();
    this.clientSecret = (configService.get<string>('zoom.clientSecret') ?? '').trim();
    const rawOauthUrl = (configService.get<string>('zoom.oauthUrl') ?? 'https://zoom.us/oauth/token').trim();
    this.oauthUrl = this.normaliseOauthUrl(rawOauthUrl);
    const explicitEnabled = configService.get<string>('zoom.enabled');
    let enabled: boolean;
    if (explicitEnabled !== undefined && explicitEnabled !== null) {
      const flag = explicitEnabled.toString().toLowerCase();
      enabled = flag === 'true';
    } else {
      enabled = Boolean(this.accountId && this.clientId && this.clientSecret);
    }

    if (!enabled) {
      this.logger.warn('Zoom integration is disabled. Meetings will use local placeholders.');
    } else if (!this.accountId || !this.clientId || !this.clientSecret) {
      this.logger.error('Zoom integration is enabled but required credentials are missing.');
      enabled = false;
    } else if (this.oauthUrl !== rawOauthUrl) {
      this.logger.warn(`Normalised Zoom OAuth URL to ${this.oauthUrl}. Original value "${rawOauthUrl}" did not match Zoom token endpoint.`);
    }
    this.enabled = enabled;

    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  private normaliseOauthUrl(url: string): string {
    if (!url) {
      return 'https://zoom.us/oauth/token';
    }

    try {
      const parsed = new URL(url);
      if (!parsed.pathname.endsWith('/token')) {
        parsed.pathname = '/oauth/token';
        parsed.search = '';
        return parsed.toString();
      }
    } catch (error) {
      this.logger.warn(`Invalid Zoom OAuth URL "${url}". Falling back to default token endpoint.`);
      return 'https://zoom.us/oauth/token';
    }

    return url;
  }

  async createMeeting(hostId: string, payload: CreateZoomMeetingPayload): Promise<ZoomMeetingResponse> {
    if (!this.enabled) {
      this.logger.debug(`Zoom disabled. Returning placeholder meeting for host ${hostId}.`);
      return this.buildPlaceholderMeeting(hostId, payload);
    }

    const userIdentifier = encodeURIComponent(hostId);
    try {
      return await this.executeRequest<ZoomMeetingResponse>({
        method: 'POST',
        url: `/users/${userIdentifier}/meetings`,
        data: payload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to create Zoom meeting for host ${hostId}. Reason: ${message}`,
      );
      throw error;
    }
  }

  async updateMeeting(meetingId: string, payload: UpdateZoomMeetingPayload): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`Zoom disabled. Skipping meeting update for ${meetingId}.`);
      return;
    }

    await this.executeRequest<void>({
      method: 'PATCH',
      url: `/meetings/${encodeURIComponent(meetingId)}`,
      data: payload,
    });
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`Zoom disabled. Skipping meeting deletion for ${meetingId}.`);
      return;
    }

    await this.executeRequest<void>({
      method: 'DELETE',
      url: `/meetings/${encodeURIComponent(meetingId)}`,
    });
  }

  async getMeeting(meetingId: string): Promise<ZoomMeetingResponse> {
    if (!this.enabled) {
      this.logger.debug(`Zoom disabled. Returning placeholder meeting for id ${meetingId}.`);
      return this.buildPlaceholderMeeting('placeholder', {
        topic: 'Placeholder meeting',
        start_time: new Date().toISOString(),
      });
    }

    return this.executeRequest<ZoomMeetingResponse>({
      method: 'GET',
      url: `/meetings/${encodeURIComponent(meetingId)}`,
    });
  }

  async getMeetingParticipants(
    meetingId: string,
    options?: { pageSize?: number; nextPageToken?: string },
  ): Promise<ZoomParticipantsResponse> {
    if (!this.enabled) {
      this.logger.debug(`Zoom disabled. Returning empty participants for meeting ${meetingId}.`);
      return { participants: [], total_records: 0 };
    }

    return this.executeRequest<ZoomParticipantsResponse>({
      method: 'GET',
      url: `/report/meetings/${encodeURIComponent(meetingId)}/participants`,
      params: {
        page_size: options?.pageSize ?? 100,
        next_page_token: options?.nextPageToken,
      },
    });
  }

  private async executeRequest<T>(config: AxiosRequestConfig, retry = true): Promise<T> {
    if (!this.enabled) {
      throw new BadGatewayException('Zoom integration is disabled.');
    }

    const accessToken = await this.getAccessToken();
    try {
      const response = await this.http.request<T>({
        ...config,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(config.headers ?? {}),
        },
      });
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.response?.status === 401 && retry) {
          this.logger.warn('Zoom access token expired. Refreshing and retrying request.');
          this.tokenCache = null;
          return this.executeRequest<T>(config, false);
        }
        const zoomDetail = this.describeAxiosError(error);
        this.logger.error(`Zoom API error: ${zoomDetail}`);
        // Surface the real Zoom error in non-production environments to ease debugging.
        if (process.env.NODE_ENV !== 'production') {
          throw new BadGatewayException(`Zoom API error — ${zoomDetail}`);
        }
      } else {
        this.logger.error(`Zoom API unexpected error: ${(error as Error).message}`);
      }
      throw new BadGatewayException('Zoom API request failed. Please try again later.');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (!this.enabled) {
      throw new BadGatewayException('Zoom integration is disabled.');
    }

    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const url = `${this.oauthUrl}?grant_type=account_credentials&account_id=${encodeURIComponent(this.accountId)}`;

    try {
      const redactedAccountId =
        this.accountId.length > 6
          ? `${this.accountId.slice(0, 3)}***${this.accountId.slice(-3)}`
          : this.accountId;
      this.logger.debug(`Requesting Zoom access token from ${this.oauthUrl} for account ${redactedAccountId}`);
      const response = await axios.post<ZoomTokenResponse>(url, null, {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
        timeout: 10000,
      });

      const { access_token: accessToken, expires_in: expiresIn } = response.data;
      const expiresAt = Date.now() + (expiresIn - 60) * 1000; // refresh 1 minute before expiry
      this.tokenCache = { accessToken, expiresAt };
      return accessToken;
    } catch (error) {
      if (isAxiosError(error)) {
        this.logger.error(`Failed to refresh Zoom access token: ${this.describeAxiosError(error)}`);
      } else {
        this.logger.error(`Failed to refresh Zoom access token: ${(error as Error).message}`);
      }
      throw new BadGatewayException('Unable to authenticate with Zoom API.');
    }
  }

  private describeAxiosError(error: AxiosError): string {
    const status = error.response?.status ?? 'unknown';
    const message = error.response?.data && typeof error.response.data === 'object'
      ? JSON.stringify(error.response.data)
      : error.message;
    return `status=${status} message=${message}`;
  }

  private buildPlaceholderMeeting(
    hostId: string,
    payload: Partial<CreateZoomMeetingPayload>,
  ): ZoomMeetingResponse {
    this.logger.warn(
      `Issuing placeholder meeting for host ${hostId}. Check Zoom credentials and OAuth configuration if this is unexpected.`,
    );
    const now = new Date();
    const id = Math.floor(now.getTime() / 1000);
    return {
      uuid: `placeholder-${id}`,
      id,
      host_id: hostId,
      topic: payload.topic ?? 'Class session',
      type: 2,
      status: 'created',
      start_time: payload.start_time,
      duration: payload.duration,
      timezone: payload.timezone,
      agenda: payload.agenda,
      created_at: now.toISOString(),
      start_url: `https://zoom.us/s/${id}`,
      join_url: `https://zoom.us/wc/${id}/join?prefer=1`,
      password: undefined,
    };
  }
}
