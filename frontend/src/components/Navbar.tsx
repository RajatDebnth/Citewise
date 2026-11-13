import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const Navbar: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="border-b bg-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/app" className="flex items-center space-x-2 font-bold text-sm sm:text-base tracking-tight hover:opacity-90">
          <BookOpen className="h-5 w-5 text-primary" />
          <span>Knowledge Assistant</span>
        </Link>

        {user && (
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border">
              <UserIcon className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium truncate max-w-[180px]">{user.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md hover:bg-muted transition"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
