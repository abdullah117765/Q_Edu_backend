export interface CreateZoomMeetingPayload {
  topic: string;
  type?: number;
  start_time: string;
  duration?: number;
  timezone?: string;
  agenda?: string;
  settings?: ZoomMeetingSettings;
}

export interface UpdateZoomMeetingPayload {
  topic?: string;
  agenda?: string;
  start_time?: string;
  duration?: number;
  timezone?: string;
  settings?: ZoomMeetingSettings;
}

export interface ZoomMeetingSettings {
  host_video?: boolean;
  participant_video?: boolean;
  join_before_host?: boolean;
  mute_upon_entry?: boolean;
  waiting_room?: boolean;
  auto_recording?: 'local' | 'cloud' | 'none';
  approval_type?: 0 | 1 | 2;
  registration_type?: 1 | 2 | 3;
  audio?: 'both' | 'telephony' | 'voip';
  alternative_hosts?: string;
}

export interface ZoomMeetingResponse {
  uuid: string;
  id: number;
  host_id: string;
  host_email?: string;
  topic: string;
  type: number;
  status: string;
  start_time?: string;
  duration?: number;
  timezone?: string;
  agenda?: string;
  created_at: string;
  start_url?: string;
  join_url?: string;
  password?: string;
}

export interface ZoomParticipant {
  id?: string;
  user_id?: string;
  name: string;
  user_email?: string;
  join_time?: string;
  leave_time?: string;
  duration?: number;
  attentiveness_score?: string;
  failover?: boolean;
  status?: string;
  customer_key?: string;
}

export interface ZoomParticipantsResponse {
  participants: ZoomParticipant[];
  total_records: number;
  next_page_token?: string;
}
