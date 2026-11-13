import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Folder,
  Loader2,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { ServerWakeBanner } from '../components/ServerWakeBanner';
import { ApiException, userApi, workspacesApi } from '../services/api';
import { UserMeResponse, WorkspaceSummary } from '../types';

export const WorkspacesPage: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [userMe, setUserMe] = useState<UserMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Workspace Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [wsList, me] = await Promise.all([
        workspacesApi.list(),
        userApi.getMe().catch(() => null),
      ]);
      setWorkspaces(wsList);
      if (me) setUserMe(me);
    } catch (err: any) {
      setError(err?.message || 'Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) {
      setCreateError('Workspace name cannot be empty.');
      return;
    }
    if (trimmed.length > 80) {
      setCreateError('Workspace name must be at most 80 characters.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const created = await workspacesApi.create(trimmed);
      setWorkspaces((prev) => [created, ...prev]);
      setNewWorkspaceName('');
      setIsCreateOpen(false);
      // Refresh quotas if available
      userApi.getMe().then((me) => setUserMe(me)).catch(() => {});
    } catch (err: any) {
      if (err instanceof ApiException && err.code === 'workspace_limit_exceeded') {
        setCreateError(err.message || 'Maximum workspace limit reached.');
      } else {
        setCreateError(err?.message || 'Failed to create workspace.');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceToDelete) return;
    setDeleting(true);
    try {
      await workspacesApi.delete(workspaceToDelete.id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceToDelete.id));
      setWorkspaceToDelete(null);
      userApi.getMe().then((me) => setUserMe(me)).catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'Failed to delete workspace.');
    } finally {
      setDeleting(false);
    }
  };

  const workspaceQuota = userMe?.quotas.workspaces;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ServerWakeBanner />
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Select or create a workspace to manage documents and verify answers.
            </p>
          </div>

          <button
            onClick={() => {
              setCreateError(null);
              setNewWorkspaceName('');
              setIsCreateOpen(true);
            }}
            disabled={workspaceQuota && workspaceQuota.remaining <= 0}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>New Workspace</span>
          </button>
        </div>

        {/* Quota indicator card */}
        {userMe && (
          <div className="mb-6 p-4 rounded-xl border bg-card/60 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>Signed in as <strong className="text-foreground">{userMe.profile.email}</strong></span>
              {userMe.profile.is_admin && (
                <span className="bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </div>

            <div className="flex items-center space-x-4 text-muted-foreground">
              <span>
                Workspaces: <strong className="text-foreground">{userMe.quotas.workspaces.used}/{userMe.quotas.workspaces.limit}</strong>
              </span>
              <span>•</span>
              <span>
                Daily Uploads: <strong className="text-foreground">{userMe.quotas.uploads.used}/{userMe.quotas.uploads.limit}</strong>
              </span>
              <span>•</span>
              <span>
                Daily Questions: <strong className="text-foreground">{userMe.quotas.questions.used}/{userMe.quotas.questions.limit}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={fetchData} className="text-xs font-semibold underline hover:opacity-80">
              Retry
            </button>
          </div>
        )}

        {/* Workspaces List / Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-6 border rounded-xl bg-card animate-pulse space-y-3">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-16 border rounded-xl bg-card/40 border-dashed p-8">
            <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
              <Folder className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold mb-1">No workspaces yet</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              Create your first workspace to begin uploading and querying company knowledge.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Workspace</span>
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className="group relative p-6 border rounded-xl bg-card hover:border-primary/60 transition shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <Link
                      to={`/app/w/${ws.id}`}
                      className="font-semibold text-base text-foreground group-hover:text-primary transition line-clamp-1"
                    >
                      {ws.name}
                    </Link>

                    <div className="flex items-center space-x-2 shrink-0">
                      {ws.is_demo && (
                        <span className="text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          Demo
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                          ws.role === 'owner'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {ws.role}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-4">
                    Created on {new Date(ws.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t text-xs">
                  <Link
                    to={`/app/w/${ws.id}`}
                    className="font-medium text-primary hover:underline flex items-center space-x-1"
                  >
                    <span>Open Workspace</span>
                    <span>→</span>
                  </Link>

                  {ws.role === 'owner' && (
                    <button
                      onClick={() => setWorkspaceToDelete(ws)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition"
                      title="Delete workspace"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Workspace Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border rounded-xl shadow-lg p-6 relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold mb-1">Create New Workspace</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Enter a descriptive name for your workspace (max 80 characters).
            </p>

            {createError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Workspace Name</label>
                <input
                  type="text"
                  autoFocus
                  required
                  maxLength={80}
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="e.g. Engineering Knowledge Base"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={creating}
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={creating}
                  className="px-4 py-2 border rounded-md text-xs font-medium hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition flex items-center space-x-2 disabled:opacity-60"
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{creating ? 'Creating…' : 'Create'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Workspace Confirmation Modal */}
      {workspaceToDelete && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border rounded-xl shadow-lg p-6 relative">
            <h2 className="text-lg font-bold text-destructive mb-2">Delete Workspace?</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              Are you sure you want to permanently delete <strong className="text-foreground">"{workspaceToDelete.name}"</strong>? All associated documents, chunks, and conversations will be deleted immediately. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setWorkspaceToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 border rounded-md text-xs font-medium hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-xs font-medium hover:bg-destructive/90 transition flex items-center space-x-2 disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{deleting ? 'Deleting…' : 'Yes, Delete Workspace'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
