import React from 'react';
import { useParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

export const ChatPage: React.FC = () => {
  const { wid, cid } = useParams<{ wid: string; cid?: string }>();

  return (
    <div className="h-full flex flex-col p-6">
      <header className="border-b pb-4 mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Chat</h2>
        <span className="text-xs text-muted-foreground">
          Workspace: {wid} {cid && `• Conversation: ${cid}`}
        </span>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
        <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm">Conversation history and chat interface will be enabled in Phase 7.</p>
      </div>
    </div>
  );
};

