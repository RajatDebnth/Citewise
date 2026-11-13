import React from 'react';
import { Link } from 'react-router-dom';

export const SignupPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/40">
      <div className="w-full max-w-sm border rounded-lg p-6 bg-card shadow-sm">
        <h2 className="text-xl font-bold mb-2">Create an Account</h2>
        <p className="text-xs text-muted-foreground mb-6">
          Sign up to manage knowledge bases and documents.
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium">Email address</label>
            <input
              type="email"
              placeholder="name@company.com"
              className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
              disabled
            />
          </div>
          <div>
            <label className="text-xs font-medium">Password</label>
            <input
              type="password"
              className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
              disabled
            />
          </div>
          <button
            disabled
            className="w-full py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md opacity-60"
          >
            Sign Up (Phase 0 Stub)
          </button>
        </div>
        <div className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};

