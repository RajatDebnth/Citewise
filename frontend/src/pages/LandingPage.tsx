import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Sparkles,
  Shield,
  ArrowRight,
  FileCheck,
  Lock,
  Layers,
  Cpu,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Navigation Header */}
      <header className="px-6 py-4 border-b flex items-center justify-between bg-card/60 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center space-x-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight block">
              Knowledge Assistant
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block -mt-1">
              Grounded RAG Platform
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-5">
          <Link
            to="/demo"
            className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Public Demo
          </Link>
          <Link
            to="/login"
            className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="text-xs sm:text-sm font-medium bg-primary text-primary-foreground px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-primary/90 transition-colors shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-6 pt-16 pb-20 text-center flex flex-col items-center">
          <div className="inline-flex items-center space-x-2 bg-primary/10 border border-primary/20 text-primary px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6 shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Strict Grounded Retrieval-Augmented Generation</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight max-w-3xl mb-6 leading-tight">
            Grounded answers backed by{' '}
            <span className="text-primary underline decoration-primary/30 decoration-wavy">
              exact citations
            </span>{' '}
            from your company docs.
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            Ingest employee handbooks, travel guidelines, and engineering specifications. Ask complex questions and receive verified answers with page and section references—backed by a zero-hallucination threshold gate.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
            <Link
              to="/demo"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold shadow hover:bg-primary/90 transition-all space-x-2 group"
            >
              <span>Try Acme Corp Interactive Demo</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/signup"
              className="w-full sm:w-auto px-6 py-3 rounded-lg border bg-card hover:bg-muted font-semibold transition-colors"
            >
              Create Free Workspace
            </Link>
          </div>

          {/* Quick Stats or Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl text-left border rounded-xl p-5 bg-card/50 shadow-xs">
            <div className="p-3">
              <span className="text-2xl font-bold text-primary block">768-dim</span>
              <span className="text-xs text-muted-foreground">
                L2-Normalized Embeddings
              </span>
            </div>
            <div className="p-3">
              <span className="text-2xl font-bold text-primary block">&lt;0.50</span>
              <span className="text-xs text-muted-foreground">
                Retrieval Gate Rejection
              </span>
            </div>
            <div className="p-3">
              <span className="text-2xl font-bold text-primary block">100%</span>
              <span className="text-xs text-muted-foreground">
                DB-Verified Citations
              </span>
            </div>
            <div className="p-3">
              <span className="text-2xl font-bold text-primary block">Tenant-Safe</span>
              <span className="text-xs text-muted-foreground">
                Zero Existence Leakage (404)
              </span>
            </div>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="bg-muted/30 py-20 border-y">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Architected for Enterprise Trust & Safety
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                Built from the ground up to prevent hallucinated answers, data leakage across teams, and prompt injection attacks.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 border rounded-xl bg-card shadow-xs flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 mb-4">
                    <Shield className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base mb-2">Zero Hallucinations</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    If top vector similarity falls below the threshold gate, the model is never invoked. The assistant explicitly declines to answer and logs to unanswered questions for review.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t text-[11px] font-medium text-emerald-600 flex items-center space-x-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Strict threshold fallback gate</span>
                </div>
              </div>

              <div className="p-6 border rounded-xl bg-card shadow-xs flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 mb-4">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base mb-2">Verifiable Citations</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Citations are reconstructed from PostgreSQL chunks and metadata, never from free LLM text. Clicking any citation chip opens the exact source excerpt and page number.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t text-[11px] font-medium text-blue-600 flex items-center space-x-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Interactive source side panel</span>
                </div>
              </div>

              <div className="p-6 border rounded-xl bg-card shadow-xs flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 mb-4">
                    <Lock className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base mb-2">Multi-Tenant Isolation</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every database query, vector search, and document operation is strictly workspace-scoped. Non-members receive HTTP 404 to eliminate existence leakage.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t text-[11px] font-medium text-indigo-600 flex items-center space-x-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>PostgreSQL RLS + code-level scoping</span>
                </div>
              </div>

              <div className="p-6 border rounded-xl bg-card shadow-xs flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 mb-4">
                    <Layers className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base mb-2">Resilient Ingestion</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    PyMuPDF and python-docx parse documents into semantic chunks. In-memory embedding cache eliminates redundant Gemini calls on identical content chunks.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t text-[11px] font-medium text-amber-600 flex items-center space-x-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Content-hash embedding cache</span>
                </div>
              </div>

              <div className="p-6 border rounded-xl bg-card shadow-xs flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 mb-4">
                    <Shield className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base mb-2">Upload Hardening</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Streaming 10 MB limit prevents memory spikes. Magic-byte verification rejects forged files, zip bombs, encrypted PDFs, and path-traversal filenames.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t text-[11px] font-medium text-rose-600 flex items-center space-x-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Pre-buffering streaming validation</span>
                </div>
              </div>

              <div className="p-6 border rounded-xl bg-card shadow-xs flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 mb-4">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base mb-2">Prompt Injection Guard</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Source text is treated as untrusted data within strict XML tags. The system prompt instructs the model to ignore instructions inside sources, and answers enforce a strict JSON schema.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t text-[11px] font-medium text-purple-600 flex items-center space-x-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Structured JSON schema validation</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              How the Knowledge Assistant Works
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Three seamless steps from raw document upload to audited, cited answers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="text-center p-6 bg-card border rounded-xl relative">
              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h3 className="font-bold text-base mb-2">Upload SOPs & Docs</h3>
              <p className="text-xs text-muted-foreground">
                Drop your company handbooks, travel rules, or technical manuals (PDF, DOCX, TXT) into a secure workspace.
              </p>
            </div>

            <div className="text-center p-6 bg-card border rounded-xl relative">
              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h3 className="font-bold text-base mb-2">Ingestion & Indexing</h3>
              <p className="text-xs text-muted-foreground">
                The pipeline extracts sections, strips boilerplate, and generates 768-dimensional normalized embeddings into pgvector.
              </p>
            </div>

            <div className="text-center p-6 bg-card border rounded-xl relative">
              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h3 className="font-bold text-base mb-2">Ask & Verify Citations</h3>
              <p className="text-xs text-muted-foreground">
                Ask in plain language. Read concise, structured answers with clickable inline citations back to original page numbers.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="p-8 sm:p-12 rounded-2xl bg-primary text-primary-foreground text-center shadow-lg relative overflow-hidden">
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Experience Grounded Enterprise RAG Today
              </h2>
              <p className="text-primary-foreground/80 text-sm mb-8 leading-relaxed">
                Try out the synthetic Acme Corp SOPs in our public demo without signing up, or create your own private workspace in 30 seconds.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  to="/demo"
                  className="px-6 py-3 rounded-lg bg-background text-foreground font-semibold hover:bg-background/90 transition-colors shadow-xs"
                >
                  Explore Public Demo
                </Link>
                <Link
                  to="/signup"
                  className="px-6 py-3 rounded-lg bg-primary-foreground/15 border border-primary-foreground/30 text-primary-foreground font-semibold hover:bg-primary-foreground/25 transition-colors"
                >
                  Create Free Account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-card text-xs text-muted-foreground">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">
              Company Knowledge Assistant
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <Link to="/demo" className="hover:text-foreground transition-colors">
              Public Demo
            </Link>
            <Link to="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center space-x-1"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div>
            <span>Grounded Enterprise RAG · Built with FastAPI & React</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
