import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import {
  MessageSquare,
  FileText,
  HelpCircle,
  Settings,
  ArrowLeft,
  Folder,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { ServerWakeBanner } from '../components/ServerWakeBanner';
import { workspacesApi } from '../services/api';
import { WorkspaceDetail } from '../types';

export const WorkspaceLayout: React.FC = () => {
  const { wid } = useParams<{ wid: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wid) {
      setLoading(true);
      workspacesApi
        .get(wid)
        .then((data) => setWorkspace(data))
        .catch((err) => console.error('Failed to load workspace detail:', err))
        .finally(() => setLoading(false));
    }
  }, [wid]);

  const navItems = [
    { label: 'Chat', to: `/app/w/${wid}/chat`, icon: MessageSquare },
    { label: 'Documents', to: `/app/w/${wid}/documents`, icon: FileText },
    { label: 'Unanswered', to: `/app/w/${wid}/unanswered`, icon: HelpCircle },
    { label: 'Settings', to: `/app/w/${wid}/settings`, icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      <ServerWakeBanner />
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Workspace Sidebar */}
        <aside className="w-64 border-r bg-card flex flex-col">
          <div className="p-4 border-b">
            <Link
              to="/app"
              className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              <span>Back to Workspaces</span>
            </Link>

            <div className="flex items-center space-x-2">
              <Folder className="h-4 w-4 text-primary shrink-0" />
              {loading ? (
                <div className="h-4 bg-muted rounded w-28 animate-pulse" />
              ) : (
                <h2 className="font-semibold text-sm truncate" title={workspace?.name || wid}>
                  {workspace?.name || wid}
                </h2>
              )}
            </div>

            {workspace && (
              <div className="flex items-center space-x-2 mt-2 text-[11px] text-muted-foreground">
                <span className="capitalize bg-muted px-2 py-0.5 rounded font-medium">
                  {workspace.role}
                </span>
                {workspace.stats && (
                  <span>
                    {workspace.stats.document_count} doc{workspace.stats.document_count === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            )}
          </div>

          <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
