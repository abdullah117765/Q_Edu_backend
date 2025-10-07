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
  private tokenCache: CachedToken | null = null;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = configService.getOrThrow<string>('zoom.apiBaseUrl');
    this.accountId = configService.getOrThrow<string>('zoom.accountId');
    this.clientId = configService.getOrThrow<string>('zoom.clientId');
    this.clientSecret = configService.getOrThrow<string>('zoom.clientSecret');
    this.oauthUrl = configService.getOrThrow<string>('zoom.oauthUrl');

    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  async createMeeting(hostId: string, payload: CreateZoomMeetingPayload): Promise<ZoomMeetingResponse> {
    const userIdentifier = encodeURIComponent(hostId);
    return this.executeRequest<ZoomMeetingResponse>({
      method: 'POST',
      url: `/users/${userIdentifier}/meetings`,
      data: payload,
    });
  }

  async updateMeeting(meetingId: string, payload: UpdateZoomMeetingPayload): Promise<void> {
    await this.executeRequest<void>({
      method: 'PATCH',
      url: `/meetings/${encodeURIComponent(meetingId)}`,
      data: payload,
    });
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    await this.executeRequest<void>({
      method: 'DELETE',
      url: `/meetings/${encodeURIComponent(meetingId)}`,
    });
  }

  async getMeeting(meetingId: string): Promise<ZoomMeetingResponse> {
    return this.executeRequest<ZoomMeetingResponse>({
      method: 'GET',
      url: `/meetings/${encodeURIComponent(meetingId)}`,
    });
  }

  async getMeetingParticipants(
    meetingId: string,
    options?: { pageSize?: number; nextPageToken?: string },
  ): Promise<ZoomParticipantsResponse> {
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
        this.logger.error(`Zoom API error: ${this.describeAxiosError(error)}`);
      } else {
        this.logger.error(`Zoom API unexpected error: ${(error as Error).message}`);
      }
      throw new BadGatewayException('Zoom API request failed. Please try again later.');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const url = `${this.oauthUrl}?grant_type=account_credentials&account_id=${encodeURIComponent(this.accountId)}`;

    try {
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
}
