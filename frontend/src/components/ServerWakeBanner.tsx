import React from 'react';
import { Loader2 } from 'lucide-react';
import { useServerWake } from '../hooks/useServerWake';

export const ServerWakeBanner: React.FC = () => {
  const { isWaking } = useServerWake();

  if (!isWaking) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-center text-xs sm:text-sm font-medium flex items-center justify-center space-x-2 sticky top-0 z-50 shadow-sm animate-pulse">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Waking the server, this can take up to a minute…</span>
    </div>
  );
};

