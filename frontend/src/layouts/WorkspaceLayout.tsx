import React from 'react';
import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import { MessageSquare, FileText, HelpCircle, Settings, ArrowLeft } from 'lucide-react';

export const WorkspaceLayout: React.FC = () => {
  const { wid = 'default' } = useParams<{ wid: string }>();

  const navItems = [
    { label: 'Chat', to: `/app/w/${wid}/chat`, icon: MessageSquare },
    { label: 'Documents', to: `/app/w/${wid}/documents`, icon: FileText },
    { label: 'Unanswered', to: `/app/w/${wid}/unanswered`, icon: HelpCircle },
    { label: 'Settings', to: `/app/w/${wid}/settings`, icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <Link to="/app" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Workspaces
          </Link>
          <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded truncate max-w-[100px]">{wid}</span>
        </div>
        <nav className="p-3 space-y-1 flex-1">
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

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

