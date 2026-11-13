import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles, Shield, ArrowRight } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Company Knowledge Assistant</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            to="/demo"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Try the demo
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
          >
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center space-x-2 bg-muted px-3 py-1 rounded-full text-xs font-semibold mb-6">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Grounded Retrieval-Augmented Generation</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          Verified answers directly from your company's documents
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          Upload handbooks, policies, and specifications. Ask questions and get accurate answers with exact page and section citations.
        </p>

        <div className="flex items-center space-x-4 mb-16">
          <Link
            to="/demo"
            className="inline-flex items-center px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90"
          >
            Try Interactive Demo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            to="/login"
            className="px-6 py-3 rounded-md border font-medium hover:bg-muted"
          >
            Sign In to Workspace
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 text-left w-full">
          <div className="p-6 border rounded-lg bg-card">
            <Shield className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-bold mb-2">Zero Hallucinations</h3>
            <p className="text-sm text-muted-foreground">
              Answers only cite verified document contents with threshold gating.
            </p>
          </div>
          <div className="p-6 border rounded-lg bg-card">
            <BookOpen className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-bold mb-2">Exact Citations</h3>
            <p className="text-sm text-muted-foreground">
              Every sentence points back to the exact page, section, and document source.
            </p>
          </div>
          <div className="p-6 border rounded-lg bg-card">
            <Sparkles className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-bold mb-2">Tenant Isolation</h3>
            <p className="text-sm text-muted-foreground">
              Workspaces isolate data with strict multi-tenant access control and RLS.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

