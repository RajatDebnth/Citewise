import React from 'react';
import { useParams } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';

export const DocumentsPage: React.FC = () => {
  const { wid } = useParams<{ wid: string }>();

  return (
    <div className="h-full flex flex-col p-6">
      <header className="border-b pb-4 mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Documents</h2>
        <span className="text-xs text-muted-foreground">Workspace: {wid}</span>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
        <UploadCloud className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm">Document upload and status monitoring will be enabled in Phase 4.</p>
      </div>
    </div>
  );
};

