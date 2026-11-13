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

// ---------------------------------------------------------------------------
// Chat & RAG Types
// ---------------------------------------------------------------------------

export interface CitationItem {
  n: number;
  chunk_id: string;
  document_id: string;
  filename: string;
  page_start?: number | null;
  page_end?: number | null;
  section_title?: string | null;
  score: number;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  grounded?: boolean | null;
  citations?: CitationItem[];
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  answer: string;
  grounded: boolean;
  citations: CitationItem[];
}

export interface SendChatRequest {
  conversation_id?: string;
  question: string;
  document_ids?: string[];
}

export interface FeedbackPayload {
  rating: 1 | -1;
  comment?: string;
}

export interface UnansweredItem {
  id: string;
  question: string;
  top_score?: number | null;
  status: 'open' | 'resolved' | 'ignored';
  message_id?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Demo & Admin Types
// ---------------------------------------------------------------------------

export interface DemoDocument {
  id: string;
  filename: string;
  page_count?: number | null;
  chunk_count: number;
}

export interface DemoChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: CitationItem[];
  grounded?: boolean;
}

export interface DemoChatResponse {
  answer: string;
  grounded: boolean;
  citations: CitationItem[];
}

export interface AdminUsage {
  db_size_bytes: number;
  total_workspaces: number;
  total_documents: number;
  total_chunks: number;
  active_users_7d: number;
  gemini_calls_today: {
    embed_calls: number;
    llm_calls: number;
    total: number;
    daily_budget: number;
    questions: number;
    demo_questions: number;
  };
  settings: Record<string, any>;
}

export interface AdminSettingsUpdate {
  uploads_enabled?: boolean;
  chat_enabled?: boolean;
  global_max_chunks?: number;
}


