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
