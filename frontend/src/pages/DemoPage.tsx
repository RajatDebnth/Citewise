import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

export const DemoPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-amber-100 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900 px-4 py-2 text-center text-xs text-amber-800 dark:text-amber-200">
        Demo Mode: Synthetic documents only. Nothing is saved.
      </div>
      <header className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="font-bold">Public Demo</span>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto p-6 flex flex-col items-center justify-center text-center">
        <Sparkles className="h-10 w-10 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-2">Interactive Demo Interface</h2>
        <p className="text-muted-foreground text-sm max-w-md mb-6">
          Phase 0 routing stub. The chat UI and synthetic demo corpus will be active in later phases.
        </p>
      </main>
    </div>
  );
};

