export interface WorkspaceSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
  is_demo: boolean;
  created_at: string;
}

export interface WorkspaceStats {
  document_count: number;
  chunk_count: number;
  member_count: number;
}

export interface WorkspaceDetail extends WorkspaceSummary {
  stats: WorkspaceStats;
}

export interface QuotaUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface UserProfile {
  id: string;
  email?: string;
  display_name?: string;
  is_admin: boolean;
  created_at: string;
}

export interface UserQuotas {
  questions: QuotaUsage;
  uploads: QuotaUsage;
  workspaces: QuotaUsage;
}

export interface UserMeResponse {
  profile: UserProfile;
  quotas: UserQuotas;
}

export interface ApiError {
  code: string;
  message: string;
}

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface DocumentSummary {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  page_count?: number | null;
  chunk_count: number;
  created_at: string;
  error_message?: string | null;
}

export interface DocumentDetail extends DocumentSummary {
  workspace_id: string;
  storage_path?: string | null;
  attempts: number;
  processed_at?: string | null;
}

export interface DocumentUploadResponse {
  id: string;
  status: DocumentStatus;
}

export interface DocumentDownloadResponse {
  download_url: string;
  expires_in: number;
}
