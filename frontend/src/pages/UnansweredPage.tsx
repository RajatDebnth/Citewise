import React from 'react';
import { useParams } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

export const UnansweredPage: React.FC = () => {
  const { wid } = useParams<{ wid: string }>();

  return (
    <div className="h-full flex flex-col p-6">
      <header className="border-b pb-4 mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Unanswered Questions</h2>
        <span className="text-xs text-muted-foreground">Workspace: {wid}</span>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
        <HelpCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm">Questions that fell below similarity threshold will appear here.</p>
      </div>
    </div>
  );
};

