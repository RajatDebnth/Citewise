import { supabase } from '../lib/supabase';
import {
  AdminSettingsUpdate,
  AdminUsage,
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
  DemoChatResponse,
  DemoDocument,
  DocumentDetail,
  DocumentDownloadResponse,
  DocumentSummary,
  DocumentUploadResponse,
  FeedbackPayload,
  SendChatRequest,
  UnansweredItem,
  UserMeResponse,
  WorkspaceDetail,
  WorkspaceSummary,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const DEFAULT_TIMEOUT_MS = 90_000; // 90 seconds timeout per Blueprint Section 9

export class ApiException extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
  retries?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipAuth = false,
    retries = 2,
    headers: customHeaders = {},
    ...fetchOptions
  } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  // Helper to execute single attempt
  const executeAttempt = async (tokenOverride?: string): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((customHeaders as Record<string, string>) || {}),
    };

    if (!(fetchOptions.body instanceof FormData) && !headers['Content-Type'] && fetchOptions.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    if (!skipAuth) {
      let token = tokenOverride;
      if (!token) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token;
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      return await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let response = await executeAttempt();

      // Handle 401: Refresh session and retry once
      if (response.status === 401 && !skipAuth && attempt === 0) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session?.access_token) {
          response = await executeAttempt(refreshData.session.access_token);
        }
      }

      // Retry on 502/503/504
      if ([502, 503, 504].includes(response.status) && attempt < retries) {
        const delay = 500 * Math.pow(2, attempt) + Math.random() * 200;
        await sleep(delay);
        continue;
      }

      // Handle non-2xx responses
      if (!response.ok) {
        let errorCode = 'api_error';
        let errorMessage = `Request failed with status ${response.status}`;

        try {
          const errorJson = await response.json();
          if (errorJson?.error) {
            errorCode = errorJson.error.code || errorCode;
            errorMessage = errorJson.error.message || errorMessage;
          }
        } catch {
          // Response body was not JSON
        }

        throw new ApiException(response.status, errorCode, errorMessage);
      }

      // 204 No Content
      if (response.status === 204) {
        return null as unknown as T;
      }

      return (await response.json()) as T;
    } catch (err: any) {
      lastError = err;

      if (err instanceof ApiException) {
        throw err;
      }

      // Network errors / aborts retryable
      if (attempt < retries) {
        const delay = 500 * Math.pow(2, attempt) + Math.random() * 200;
        await sleep(delay);
        continue;
      }
    }
  }

  throw (
    lastError ||
    new ApiException(0, 'network_error', 'Network error or request timeout')
  );
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};

// Workspace endpoints
export const workspacesApi = {
  list: () => api.get<WorkspaceSummary[]>('/workspaces'),
  get: (wid: string) => api.get<WorkspaceDetail>(`/workspaces/${wid}`),
  create: (name: string) => api.post<WorkspaceSummary>('/workspaces', { name }),
  update: (wid: string, name: string) =>
    api.patch<WorkspaceSummary>(`/workspaces/${wid}`, { name }),
  delete: (wid: string) => api.delete<void>(`/workspaces/${wid}`),
};

// User profile and quota endpoints
export const userApi = {
  getMe: () => api.get<UserMeResponse>('/me'),
};

// Document endpoints
export const documentsApi = {
  list: (wid: string) => api.get<DocumentSummary[]>(`/workspaces/${wid}/documents`),
  get: (wid: string, did: string) =>
    api.get<DocumentDetail>(`/workspaces/${wid}/documents/${did}`),
  upload: (wid: string, file: File, confidentialityAck: boolean) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('confidentiality_ack', String(confidentialityAck));
    return api.post<DocumentUploadResponse>(
      `/workspaces/${wid}/documents`,
      formData
    );
  },
  retry: (wid: string, did: string) =>
    api.post<DocumentSummary>(`/workspaces/${wid}/documents/${did}/retry`),
  download: (wid: string, did: string) =>
    api.get<DocumentDownloadResponse>(
      `/workspaces/${wid}/documents/${did}/download`
    ),
  delete: (wid: string, did: string) =>
    api.delete<void>(`/workspaces/${wid}/documents/${did}`),
};

// Chat and RAG endpoints
export const chatApi = {
  sendMessage: (wid: string, payload: SendChatRequest) =>
    api.post<ChatResponse>(`/workspaces/${wid}/chat`, payload),
  listConversations: (wid: string) =>
    api.get<ConversationSummary[]>(`/workspaces/${wid}/conversations`),
  getConversation: (wid: string, cid: string) =>
    api.get<ConversationDetail>(`/workspaces/${wid}/conversations/${cid}`),
  renameConversation: (wid: string, cid: string, title: string) =>
    api.patch<ConversationSummary>(`/workspaces/${wid}/conversations/${cid}`, { title }),
  deleteConversation: (wid: string, cid: string) =>
    api.delete<void>(`/workspaces/${wid}/conversations/${cid}`),
  sendFeedback: (mid: string, payload: FeedbackPayload) =>
    api.post<{ status: string; message_id: string; rating: number }>(`/messages/${mid}/feedback`, payload),
  listUnanswered: (wid: string) =>
    api.get<UnansweredItem[]>(`/workspaces/${wid}/unanswered`),
  updateUnansweredStatus: (wid: string, uid: string, status: 'open' | 'resolved' | 'ignored') =>
    api.patch<UnansweredItem>(`/workspaces/${wid}/unanswered/${uid}`, { status }),
};

// Health endpoints
export const healthApi = {
  check: () => api.get<{ status: string }>('/health', { skipAuth: true, timeoutMs: 10_000 }),
};

// Demo endpoints (Blueprint 5.4)
export const demoApi = {
  getDocuments: () =>
    api.get<DemoDocument[]>('/demo/documents', { skipAuth: true }),
  sendChat: (payload: { question: string; history?: { role: string; content: string }[] }) =>
    api.post<DemoChatResponse>('/demo/chat', payload, { skipAuth: true }),
};

// Admin endpoints (Blueprint 5.5)
export const adminApi = {
  getUsage: () =>
    api.get<AdminUsage>('/admin/usage'),
  updateSettings: (payload: AdminSettingsUpdate) =>
    api.patch<Record<string, any>>('/admin/settings', payload),
};

