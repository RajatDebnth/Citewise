import React from 'react';
import { Link } from 'react-router-dom';
import { Folder, Plus } from 'lucide-react';

export const WorkspacesPage: React.FC = () => {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-sm text-muted-foreground">Select or create a workspace</p>
        </div>
        <button
          disabled
          className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm opacity-60"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Workspace
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link
          to="/app/w/demo-workspace/chat"
          className="p-6 border rounded-lg hover:border-primary transition bg-card"
        >
          <div className="flex items-center space-x-3 mb-2">
            <Folder className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Default Workspace (Stub)</h3>
          </div>
          <p className="text-xs text-muted-foreground">Click to view workspace shell</p>
        </Link>
      </div>
    </div>
  );
};

