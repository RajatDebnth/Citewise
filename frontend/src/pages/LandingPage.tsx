import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  Sparkles,
  FileText,
  Lock,
  RefreshCw,
  Cpu,
  CheckCircle2,
  Menu,
  X,
  ExternalLink,
  Search,
  Check,
} from 'lucide-react';

interface DemoQA {
  keys: string[];
  question: string;
  answer: string;
  source: string;
  page: string;
  section: string;
  excerpt: string;
}

const DEMO_ANSWERS: DemoQA[] = [
  {
    keys: ['travel', 'flight', 'trip', 'international', 'hotel'],
    question: 'What is the approval process for international travel?',
    answer:
      'All international travel must be approved by your direct manager before booking on Navan. Flight reservations exceeding $500 USD require explicit pre-approval from the Department VP. Business class is permitted solely for direct routes exceeding 6 continuous flight hours.',
    source: 'Travel & Expense Policy (FIN-SOP-204)',
    page: 'Page 1',
    section: 'Section 1 · Flight Bookings',
    excerpt:
      'All business flights, lodging, and vehicle rentals must be booked exclusively through the Acme Corporate Travel Portal (Navan). Any flight exceeding $500 USD total cost requires written pre-approval from the Department Vice President before ticket issuance.',
  },
  {
    keys: ['leave', 'pto', 'vacation', 'time off', 'holiday'],
    question: "What is Acme Corp's annual PTO rollover policy?",
    answer:
      'Full-time employees accrue 20 days of Paid Time Off per calendar year (1.67 days/month). Up to a maximum of 5 unused PTO days can be rolled over into the consecutive calendar year. Any unused days beyond 5 expire on December 31 without payout.',
    source: 'Leave & Attendance SOP (SOP-HR-101)',
    page: 'Page 1',
    section: 'Section 1 · Paid Time Off (PTO) Policy',
    excerpt:
      'Up to a maximum of 5 unused PTO days may be rolled over into the consecutive calendar year. Any additional accrued but unused PTO beyond 5 days will expire on December 31 at midnight without financial compensation.',
  },
  {
    keys: ['security', 'password', 'mfa', 'device', 'laptop', 'lost', 'stolen'],
    question: 'How quickly must a lost or stolen laptop be reported?',
    answer:
      'Any loss or theft of an Acme device (laptop, smartphone, or hardware security key) must be reported immediately to the Information Security Operations Center within a maximum of 2 hours at security@acme.example or +1-800-555-ACME.',
    source: 'Information Security Standards (SEC-SOP-302)',
    page: 'Page 1',
    section: 'Section 3 · Incident Response',
    excerpt:
      'In the event of a lost, misplaced, or stolen Acme device, the custodian must notify Information Security immediately and within a maximum of two (2) hours from discovery to initiate an immediate remote cryptographic wipe.',
  },
];

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: 'What file types can I upload?',
    a: 'Citewise supports PDF, DOCX, and TXT documents. It processes employee handbooks, travel guidelines, legal policies, standard operating procedures (SOPs), and engineering specifications up to 10 MB per file.',
  },
  {
    q: 'How does it reduce hallucinations?',
    a: 'Citewise employs a strict cosine similarity gate. If the top-matching document chunk has a score below 0.50, the LLM is never called. The assistant immediately declines to answer and logs the query to an unanswered questions queue for team review.',
  },
  {
    q: 'Can I verify where an answer came from?',
    a: 'Yes! Every answer includes clickable citation chips [1], [2]. Clicking any citation opens a slide-out drawer showing the exact chunk excerpt, page numbers, section title, and similarity score—all reconstructed directly from PostgreSQL database records.',
  },
  {
    q: 'How is company data isolated between tenants?',
    a: 'Every database query, document operation, and vector search is strictly scoped to the active workspace. PostgreSQL row-level security (RLS) is enabled, and non-members receive a 404 response to eliminate workspace existence leakage.',
  },
  {
    q: 'Does the public demo connect to a live backend?',
    a: 'Yes! The public demo connects directly to our deployed backend on Render and Supabase, retrieving real 768-dimensional vector embeddings from synthetic Acme Corp SOP documents in pgvector.',
  },
];

export const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDemoIndex, setSelectedDemoIndex] = useState(0);
  const [demoInput, setDemoInput] = useState('');
  const [showCitationDrawer, setShowCitationDrawer] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Active question in the in-page demo sandbox
  const activeQA = DEMO_ANSWERS[selectedDemoIndex];

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoInput.trim()) return;

    const lower = demoInput.toLowerCase();
    const matchIndex = DEMO_ANSWERS.findIndex((qa) =>
      qa.keys.some((k) => lower.includes(k))
    );

    if (matchIndex !== -1) {
      setSelectedDemoIndex(matchIndex);
      setShowCitationDrawer(true);
    } else {
      setSelectedDemoIndex(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7ed] text-[#171a17] font-sans antialiased selection:bg-[#d9f078] selection:text-[#075448]">
      {/* 1. Announcement Bar */}
      <div className="bg-[#075448] text-[#f7f7ed] text-center px-4 py-2.5 text-xs font-medium tracking-wide flex items-center justify-center space-x-2">
        <span>Introducing grounded answers for your company knowledge</span>
        <Link
          to="/demo"
          className="font-bold underline underline-offset-4 decoration-[#d9f078] hover:text-[#d9f078] transition-colors inline-flex items-center space-x-1"
        >
          <span>Try the live demo</span>
          <span className="text-xs">↗</span>
        </Link>
      </div>

      {/* 2. Navigation Header */}
      <div className="sticky top-0 z-40 bg-[#f7f7ed]/90 backdrop-blur-md border-b border-[#171a17]/10 transition-all">
        <nav className="max-w-6xl mx-auto h-20 px-6 sm:px-8 flex items-center justify-between">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center space-x-2.5 font-bold text-xl tracking-tight text-[#171a17]"
          >
            <span className="w-8 h-8 rounded-lg bg-[#075448] text-[#d9f078] flex items-center justify-center text-sm font-black shadow-xs">
              ⌘
            </span>
            <span>Citewise</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-[#424840]">
            <a
              href="#platform"
              className="hover:text-[#075448] transition-colors"
            >
              Platform
            </a>
            <a
              href="#how-it-works"
              className="hover:text-[#075448] transition-colors"
            >
              How it works
            </a>
            <a
              href="#security"
              className="hover:text-[#075448] transition-colors"
            >
              Trust & safety
            </a>
            <a href="#faq" className="hover:text-[#075448] transition-colors">
              FAQ
            </a>
            <Link
              to="/demo"
              className="hover:text-[#075448] transition-colors inline-flex items-center space-x-1"
            >
              <span>Public demo</span>
              <span className="text-xs">↗</span>
            </Link>
          </div>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              to="/login"
              className="text-sm font-semibold text-[#424840] hover:text-[#075448] px-3 py-2 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-full px-5 py-2.5 bg-[#075448] hover:bg-[#0c6657] text-[#fffef7] text-sm font-bold tracking-tight inline-flex items-center space-x-2 shadow-sm hover:shadow transition-all transform hover:-translate-y-0.5"
            >
              <span>Get started</span>
              <span className="text-xs">↗</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[#171a17] hover:bg-[#dfe2d5]/60 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </nav>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[#171a17]/10 bg-[#f7f7ed] px-6 py-4 space-y-3">
            <a
              href="#platform"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium py-1.5 text-[#424840]"
            >
              Platform
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium py-1.5 text-[#424840]"
            >
              How it works
            </a>
            <a
              href="#security"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium py-1.5 text-[#424840]"
            >
              Trust & safety
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium py-1.5 text-[#424840]"
            >
              FAQ
            </a>
            <Link
              to="/demo"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium py-1.5 text-[#075448]"
            >
              Public Demo ↗
            </Link>
            <div className="pt-3 border-t border-[#171a17]/10 flex flex-col gap-2">
              <Link
                to="/login"
                className="w-full text-center py-2 text-sm font-semibold rounded-lg border border-[#aeb8a9]"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="w-full text-center py-2 text-sm font-bold bg-[#075448] text-white rounded-lg"
              >
                Get started ↗
              </Link>
            </div>
          </div>
        )}
      </div>

      <main>
        {/* 3. Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-12 sm:pt-24 sm:pb-16 text-center px-6">
          <div className="max-w-4xl mx-auto">
            {/* Eyebrow */}
            <div className="inline-flex items-center space-x-2 border border-[#d7ddcf] rounded-full px-4 py-1.5 bg-[#fbfbf3] text-[#48564b] text-xs font-semibold tracking-wider uppercase mb-6 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#8bbd47] animate-ping" />
              <span>Strict Grounded Retrieval-Augmented Generation</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-medium tracking-tight leading-[0.98] text-[#171a17] mb-6">
              Your company knowledge.
              <br />
              <em className="font-serif italic font-normal text-[#075448] block mt-1">
                Finally trustworthy.
              </em>
            </h1>

            {/* Copy */}
            <p className="max-w-2xl mx-auto text-[#596158] text-lg sm:text-xl leading-relaxed mb-8">
              Ask complex questions across your company documents. Get clear answers backed by exact source citations—not confident-sounding guesses.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 mb-4">
              <Link
                to="/demo"
                className="group rounded-full px-7 py-3.5 bg-[#075448] hover:bg-[#0c6657] text-[#fffef7] text-sm font-bold tracking-tight inline-flex items-center space-x-2 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                <span>Try the interactive demo</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#platform"
                className="rounded-full px-6 py-3.5 border border-[#aeb8a9] hover:bg-[#dfe2d5]/40 text-[#171a17] text-sm font-semibold tracking-tight inline-flex items-center transition-colors"
              >
                Explore the platform
              </a>
            </div>

            <p className="text-xs text-[#7a8076]">
              No sign-up required for the Acme Corp public demo
            </p>
          </div>

          {/* Interactive Hero Stage */}
          <div className="max-w-5xl mx-auto mt-14 sm:mt-18 relative min-h-[460px] flex items-center justify-center">
            {/* Concentric Orbit Rings (Wispr Flow style) */}
            <div className="absolute w-[92vw] max-w-[860px] h-[360px] border border-[#dfe3d6] rounded-full rotate-[-8deg] pointer-events-none" />
            <div className="absolute w-[80vw] max-w-[720px] h-[300px] border border-[#e5e7dc] rounded-full rotate-[12deg] pointer-events-none" />

            {/* Floating Badge Left */}
            <div className="hidden lg:block absolute left-0 top-12 z-20 bg-[#fffef8] border border-[#e0e4d9] rounded-xl p-4 shadow-lg text-left animate-float-left max-w-[210px]">
              <span className="text-[10px] text-[#899185] uppercase tracking-wider block font-semibold">
                Retrieval Threshold
              </span>
              <span className="font-serif text-3xl text-[#075448] font-normal block my-0.5">
                &lt; 0.50
              </span>
              <span className="text-[10px] text-[#6c7469] block leading-tight">
                Low-confidence queries rejected before calling model
              </span>
            </div>

            {/* Floating Badge Right */}
            <div className="hidden lg:block absolute right-0 bottom-12 z-20 bg-[#fffef8] border border-[#e0e4d9] rounded-xl p-4 shadow-lg text-left animate-float-right max-w-[220px]">
              <div className="w-5 h-5 rounded-full bg-[#e8f0dc] text-[#075448] flex items-center justify-center text-xs font-bold mb-1.5">
                ✓
              </div>
              <span className="text-[10px] text-[#899185] uppercase tracking-wider block font-semibold">
                Source Verified
              </span>
              <span className="text-xs font-bold text-[#171a17] block mt-0.5">
                Page 12 · Travel Policy
              </span>
              <span className="text-[10px] text-[#6c7469] block">
                Reconstructed from PostgreSQL chunk
              </span>
            </div>

            {/* Product Window Card */}
            <div className="relative z-10 w-full max-w-3xl bg-[#fffef9] border border-[#dce1d6] rounded-2xl shadow-2xl overflow-hidden text-left transform sm:-rotate-1 transition-transform hover:rotate-0 duration-300">
              {/* Window Header */}
              <div className="h-11 border-b border-[#e8eadf] px-4 flex items-center justify-between bg-[#fafaf4]/70">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d6d9ce]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d6d9ce]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d6d9ce]" />
                </div>
                <span className="text-[11px] font-semibold text-[#7c8278] tracking-wider uppercase">
                  ACME CORP · KNOWLEDGE WORKSPACE
                </span>
                <span className="w-4" />
              </div>

              {/* App Body */}
              <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] min-h-[310px]">
                {/* Sidebar */}
                <div className="hidden sm:block p-4 border-r border-[#e8eadf] bg-[#fafaf4]">
                  <div className="text-xs font-bold mb-4 flex items-center space-x-2 text-[#171a17]">
                    <span className="w-5 h-5 rounded-md bg-[#e3edcf] text-[#075448] flex items-center justify-center text-xs">
                      ✳
                    </span>
                    <span>Acme Corp</span>
                  </div>

                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#999f93] block mb-2">
                    Workspace
                  </span>
                  <div className="text-xs px-2.5 py-1.5 rounded-md bg-[#eaf0df] text-[#075448] font-bold mb-1">
                    ✦ Ask knowledge
                  </div>
                  <div className="text-xs px-2.5 py-1.5 rounded-md text-[#5c655b] hover:bg-[#e8eadf]/50 transition-colors cursor-pointer mb-1">
                    ▤ Documents
                  </div>
                  <div className="text-xs px-2.5 py-1.5 rounded-md text-[#5c655b] hover:bg-[#e8eadf]/50 transition-colors cursor-pointer">
                    ◷ Unanswered
                  </div>

                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#999f93] block mt-5 mb-2">
                    Indexed SOPs
                  </span>
                  <div className="text-[11px] text-[#5c655b] py-1 flex items-center space-x-1.5">
                    <span>▧</span>
                    <span className="truncate">Employee handbook</span>
                  </div>
                  <div className="text-[11px] text-[#5c655b] py-1 flex items-center space-x-1.5">
                    <span>▧</span>
                    <span className="truncate">Travel guidelines</span>
                  </div>
                  <div className="text-[11px] text-[#5c655b] py-1 flex items-center space-x-1.5">
                    <span>▧</span>
                    <span className="truncate">Security standards</span>
                  </div>
                </div>

                {/* Main Chat Area */}
                <div className="p-5 sm:p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#171a17]">
                      Ask your company anything
                    </h3>
                    <p className="text-[11px] text-[#92988d]">
                      Answers strictly grounded in your approved documents
                    </p>

                    {/* Question Bubble */}
                    <div className="my-4 ml-auto bg-[#edf1e6] rounded-2xl rounded-tr-xs p-3.5 max-w-[85%] text-xs text-[#171a17] leading-relaxed shadow-2xs">
                      What is the approval process for international travel?
                    </div>

                    {/* Answer Bubble */}
                    <div className="border border-[#e3e7db] bg-white rounded-2xl p-4 text-xs leading-relaxed text-[#424b40] shadow-2xs">
                      <strong className="text-[#171a17]">
                        International travel requires manager approval before booking.
                      </strong>{' '}
                      Submit a travel request with the business purpose, estimated costs, and dates. Any flight exceeding $500 USD total cost requires written pre-approval from the Department Vice President before ticket issuance.
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center space-x-1 bg-[#e8f0dc] border border-[#d7e4c6] text-[#24543c] px-2 py-0.5 rounded text-[10px] font-bold">
                          <span>▤</span>
                          <span>Travel Policy · p. 1</span>
                        </span>
                        <span className="inline-flex items-center space-x-1 bg-[#e8f0dc] border border-[#d7e4c6] text-[#24543c] px-2 py-0.5 rounded text-[10px] font-bold">
                          <span>§</span>
                          <span>Section 1 · Flight Bookings</span>
                        </span>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-[#e8eadf] flex items-center space-x-2 text-[10px] text-[#899185]">
                        <span className="text-[#28724b] font-bold flex items-center space-x-1">
                          <Check className="h-3 w-3" />
                          <span>Sources verified</span>
                        </span>
                        <span>·</span>
                        <span>2 matching passages</span>
                        <span>·</span>
                        <span>100% grounded</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 flex items-center justify-between text-[11px] text-[#7a8076]">
                    <span className="flex items-center space-x-1">
                      <Sparkles className="h-3.5 w-3.5 text-[#075448]" />
                      <span>Ready to test your questions?</span>
                    </span>
                    <Link
                      to="/demo"
                      className="font-bold text-[#075448] hover:underline"
                    >
                      Open Live Demo ↗
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-xs font-semibold tracking-widest uppercase text-[#8a9085]">
            A clearer way to work with company knowledge ↓
          </div>
        </section>

        {/* 4. Infinite Animated Marquee */}
        <div className="overflow-hidden border-y border-[#dfe2d5] py-4 bg-[#fbfbf4]">
          <div className="animate-marquee flex items-center space-x-12 text-xs font-bold uppercase tracking-widest text-[#727b70]">
            <span>Employee Handbooks <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Travel Policies <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Engineering Specs <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Internal SOPs <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Verified Citations <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Zero Hallucinations <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Multi-Tenant Isolation <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Employee Handbooks <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Travel Policies <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Engineering Specs <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Internal SOPs <strong className="text-[#075448] mx-2">✳</strong></span>
            <span>Verified Citations <strong className="text-[#075448] mx-2">✳</strong></span>
          </div>
        </div>

        {/* 5. Platform Section ("Not Another Chatbot") */}
        <section id="platform" className="py-24 px-6 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left Copy */}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#748071] block mb-3">
                Not another chatbot
              </span>
              <h2 className="text-4xl sm:text-5xl font-medium tracking-tight leading-tight text-[#171a17] mb-5">
                Answers you can trust.
                <br />
                <em className="font-serif italic font-normal text-[#075448]">
                  Sources you can open.
                </em>
              </h2>
              <p className="text-[#687166] text-base leading-relaxed mb-8">
                Most AI assistants generate an answer and ask you to trust it blindly. Citewise works the other way around: retrieve first, verify the evidence, then answer.
              </p>

              <div className="space-y-6">
                <div className="flex space-x-4">
                  <span className="font-serif text-2xl text-[#075448] font-normal shrink-0">
                    01
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-[#171a17] mb-1">
                      Evidence before generation
                    </h4>
                    <p className="text-xs text-[#70786d] leading-relaxed">
                      A strict similarity gate rejects weak retrieval before the language model is called. No relevant evidence? No generated answer.
                    </p>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <span className="font-serif text-2xl text-[#075448] font-normal shrink-0">
                    02
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-[#171a17] mb-1">
                      Citations from your database
                    </h4>
                    <p className="text-xs text-[#70786d] leading-relaxed">
                      Source references are reconstructed from stored document chunks and metadata—never fabricated by the language model.
                    </p>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <span className="font-serif text-2xl text-[#075448] font-normal shrink-0">
                    03
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-[#171a17] mb-1">
                      Built for private workspaces
                    </h4>
                    <p className="text-xs text-[#70786d] leading-relaxed">
                      Every document operation, vector search, and database query is strictly scoped to the active workspace.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Visual Stacking Documents (from HTML) */}
            <div className="bg-[#e8eddf] rounded-3xl p-6 sm:p-8 min-h-[420px] relative overflow-hidden flex items-center justify-center">
              <div className="absolute w-80 h-80 rounded-full border border-[#cbd6c2] -right-16 -top-20 pointer-events-none" />

              <div className="relative z-10 w-full max-w-sm space-y-[-16px]">
                {/* Doc 1 */}
                <div className="bg-[#fffef9] border border-[#dfe5d8] rounded-xl p-4 shadow-md transition-transform hover:-translate-y-1 duration-200">
                  <div className="flex justify-between items-center text-[10px] text-[#6f796c] mb-2 font-medium">
                    <span>PDF · EMPLOYEE HANDBOOK</span>
                    <span>PAGE 01</span>
                  </div>
                  <h5 className="font-bold text-xs text-[#171a17] mb-2">
                    Leave & time-off policy
                  </h5>
                  <div className="h-1.5 rounded-full bg-[#e9ece3] w-full mb-1.5" />
                  <div className="h-1.5 rounded-full bg-[#e9ece3] w-2/3 mb-2" />
                  <span className="inline-block bg-[#e9f1df] text-[#315b40] rounded px-2 py-0.5 text-[9px] font-bold">
                    Section 1 · Annual leave
                  </span>
                </div>

                {/* Doc 2 */}
                <div className="bg-[#fffef9] border border-[#dfe5d8] rounded-xl p-4 shadow-md translate-x-4 rotate-1 transition-transform hover:-translate-y-1 duration-200">
                  <div className="flex justify-between items-center text-[10px] text-[#6f796c] mb-2 font-medium">
                    <span>TXT · TRAVEL GUIDELINES</span>
                    <span>PAGE 01</span>
                  </div>
                  <h5 className="font-bold text-xs text-[#171a17] mb-2">
                    International travel approvals
                  </h5>
                  <div className="h-1.5 rounded-full bg-[#e9ece3] w-full mb-1.5" />
                  <div className="h-1.5 rounded-full bg-[#e9ece3] w-3/4 mb-2" />
                  <span className="inline-block bg-[#e9f1df] text-[#315b40] rounded px-2 py-0.5 text-[9px] font-bold">
                    Section 1 · Flight Bookings
                  </span>
                </div>

                {/* Doc 3 */}
                <div className="bg-[#fffef9] border border-[#dfe5d8] rounded-xl p-4 shadow-md -translate-x-2 -rotate-1 transition-transform hover:-translate-y-1 duration-200">
                  <div className="flex justify-between items-center text-[10px] text-[#6f796c] mb-2 font-medium">
                    <span>TXT · SECURITY SOP</span>
                    <span>PAGE 01</span>
                  </div>
                  <h5 className="font-bold text-xs text-[#171a17] mb-2">
                    Device security & incident response
                  </h5>
                  <div className="h-1.5 rounded-full bg-[#e9ece3] w-full mb-1.5" />
                  <div className="h-1.5 rounded-full bg-[#e9ece3] w-1/2 mb-2" />
                  <span className="inline-block bg-[#e9f1df] text-[#315b40] rounded px-2 py-0.5 text-[9px] font-bold">
                    Section 3 · Incident response
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Trust is the Architecture (Deep Forest Green Banner) */}
        <section id="security" className="px-4 sm:px-6 py-6">
          <div className="max-w-6xl mx-auto bg-[#075448] text-[#f7f7ed] rounded-3xl p-8 sm:p-14 md:p-16">
            <div className="max-w-2xl mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-[#b7c9a9] block mb-2">
                Trust is the architecture
              </span>
              <h2 className="text-4xl sm:text-5xl font-medium tracking-tight leading-tight text-white mb-4">
                Designed to protect the
                <br />
                <em className="font-serif italic font-normal text-[#d9f078]">
                  integrity of every answer.
                </em>
              </h2>
              <p className="text-[#d0dbce] text-sm sm:text-base leading-relaxed">
                From document upload to the final citation, each layer is built to reduce hallucinations, prevent cross-workspace exposure, and keep untrusted content in check.
              </p>
            </div>

            {/* Trust Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Card 1 */}
              <div className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all transform hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-[#d9f078] text-[#075448] flex items-center justify-center font-bold text-lg mb-6 shadow-sm">
                  <Shield className="w-5 h-5 text-[#075448]" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Zero-hallucination gate
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  If the best vector similarity falls below the configured 0.50 threshold, the model is never invoked. The assistant declines and logs the question.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  Strict threshold fallback
                </span>
              </div>

              {/* Card 2 */}
              <div className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all transform hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-[#d9f078] text-[#075448] flex items-center justify-center font-bold text-lg mb-6 shadow-sm">
                  <FileText className="w-5 h-5 text-[#075448]" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Verifiable citations
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  Click a citation to inspect the exact stored excerpt, page number, and section that support the response.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  Database-backed sources
                </span>
              </div>

              {/* Card 3 */}
              <div className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all transform hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-[#d9f078] text-[#075448] flex items-center justify-center font-bold text-lg mb-6 shadow-sm">
                  <Lock className="w-5 h-5 text-[#075448]" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Multi-tenant isolation
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  Workspace-scoped queries and PostgreSQL row-level security keep one team's information away from another.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  404 for non-members
                </span>
              </div>

              {/* Card 4 */}
              <div className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all transform hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-[#d9f078] text-[#075448] flex items-center justify-center font-bold text-lg mb-6 shadow-sm">
                  <RefreshCw className="w-5 h-5 text-[#075448]" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Resilient ingestion
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  PDF, DOCX, and TXT parsing creates semantic chunks. A content-hash cache avoids repeated embedding work for identical content.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  Efficient indexing
                </span>
              </div>

              {/* Card 5 */}
              <div className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all transform hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-[#d9f078] text-[#075448] flex items-center justify-center font-bold text-lg mb-6 shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-[#075448]" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Hardened uploads
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  Streaming size limits and file-signature checks help reject forged files, encrypted PDFs, zip bombs, and unsafe filenames.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  10 MB upload limit
                </span>
              </div>

              {/* Card 6 */}
              <div className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all transform hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-[#d9f078] text-[#075448] flex items-center justify-center font-bold text-lg mb-6 shadow-sm">
                  <Cpu className="w-5 h-5 text-[#075448]" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Prompt injection guard
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  Retrieved source text is treated as untrusted input. Structured output validation keeps responses within the expected schema.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  Controlled generation
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 7. How It Works ("From Documents to Decisions") */}
        <section id="how-it-works" className="py-24 px-6 max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#748071] block mb-2">
              From documents to decisions
            </span>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#171a17] mb-4">
              Three steps.
              <br />
              <em className="font-serif italic font-normal text-[#075448]">
                One reliable answer.
              </em>
            </h2>
            <p className="text-sm text-[#687166]">
              Bring your existing knowledge together and make it searchable in natural language.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-[#fbfbf4] border border-[#e0e4d7] rounded-2xl p-6 flex flex-col justify-between min-h-[260px] shadow-xs">
              <div className="flex items-center space-x-2">
                <span className="border border-[#d9dfd2] rounded-md px-2.5 py-1 text-[11px] font-semibold bg-white text-[#5b6658]">
                  PDF ↗
                </span>
                <span className="border border-[#d9dfd2] rounded-md px-2.5 py-1 text-[11px] font-semibold bg-white text-[#5b6658]">
                  DOCX ↗
                </span>
                <span className="border border-[#d9dfd2] rounded-md px-2.5 py-1 text-[11px] font-semibold bg-white text-[#5b6658]">
                  TXT ↗
                </span>
              </div>

              <div className="mt-8">
                <span className="font-serif text-3xl text-[#075448] font-normal block mb-2">
                  01
                </span>
                <h4 className="font-bold text-base text-[#171a17] mb-1.5">
                  Upload your documents
                </h4>
                <p className="text-xs text-[#72796f] leading-relaxed">
                  Add employee handbooks, travel rules, internal SOPs, and technical manuals to a secure workspace.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-[#fbfbf4] border border-[#e0e4d7] rounded-2xl p-6 flex flex-col justify-between min-h-[260px] shadow-xs">
              <div className="flex items-center space-x-1.5 text-xs text-[#72796f]">
                <span className="border border-[#d9dfd2] rounded-md px-2 py-1 font-semibold bg-white text-[#5b6658]">
                  Extract
                </span>
                <span>→</span>
                <span className="border border-[#d9dfd2] rounded-md px-2 py-1 font-semibold bg-white text-[#5b6658]">
                  Chunk
                </span>
                <span>→</span>
                <span className="border border-[#d9dfd2] rounded-md px-2 py-1 font-semibold bg-white text-[#5b6658]">
                  Index
                </span>
              </div>

              <div className="mt-8">
                <span className="font-serif text-3xl text-[#075448] font-normal block mb-2">
                  02
                </span>
                <h4 className="font-bold text-base text-[#171a17] mb-1.5">
                  Ingest and index
                </h4>
                <p className="text-xs text-[#72796f] leading-relaxed">
                  Extract document content, create semantic chunks, and store normalized embeddings in PostgreSQL with pgvector.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-[#fbfbf4] border border-[#e0e4d7] rounded-2xl p-6 flex flex-col justify-between min-h-[260px] shadow-xs">
              <div className="flex items-center space-x-1.5 text-xs text-[#72796f]">
                <span className="border border-[#d9dfd2] rounded-md px-2 py-1 font-semibold bg-white text-[#5b6658]">
                  Question
                </span>
                <span>→</span>
                <span className="border border-[#d9dfd2] rounded-md px-2 py-1 font-semibold bg-white text-[#5b6658]">
                  Evidence
                </span>
                <span>→</span>
                <span className="border border-[#d9dfd2] rounded-md px-2 py-1 font-semibold bg-white text-[#5b6658]">
                  Answer
                </span>
              </div>

              <div className="mt-8">
                <span className="font-serif text-3xl text-[#075448] font-normal block mb-2">
                  03
                </span>
                <h4 className="font-bold text-base text-[#171a17] mb-1.5">
                  Ask and verify
                </h4>
                <p className="text-xs text-[#72796f] leading-relaxed">
                  Ask in plain language. Review a concise answer and open the exact cited source passages and page numbers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Interactive Live Demo Sandbox Section */}
        <section id="demo" className="py-12 px-6 max-w-6xl mx-auto">
          <div className="bg-[#e6ecdf] rounded-3xl p-6 sm:p-12 grid lg:grid-cols-[1fr_1.2fr] gap-8 items-center border border-[#d5ded0]">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#748071] block mb-2">
                Explore the public demo
              </span>
              <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#171a17] mb-4">
                Ask Acme Corp.
                <br />
                <em className="font-serif italic font-normal text-[#075448]">
                  See the evidence.
                </em>
              </h2>
              <p className="text-sm text-[#687166] leading-relaxed mb-6">
                Try a question against synthetic company policies. This live demo connects directly to our pgvector database on Supabase to retrieve verified answers with citations.
              </p>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#424840] block">
                  Quick sample questions to try:
                </span>
                {DEMO_ANSWERS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedDemoIndex(idx);
                      setShowCitationDrawer(false);
                    }}
                    className={`block w-full text-left text-xs px-3.5 py-2 rounded-lg border transition-all ${
                      selectedDemoIndex === idx
                        ? 'bg-white border-[#075448] text-[#075448] font-bold shadow-xs'
                        : 'bg-white/60 hover:bg-white border-[#dbe2d5] text-[#5c655b]'
                    }`}
                  >
                    "{item.question}"
                  </button>
                ))}
              </div>
              <div className="mt-6">
                <Link
                  to="/demo"
                  className="rounded-full px-6 py-3 bg-[#075448] hover:bg-[#0c6657] text-[#fffef7] text-xs font-bold tracking-tight inline-flex items-center space-x-2 shadow-sm transition-all"
                >
                  <span>Open Full Interactive Demo</span>
                  <span>↗</span>
                </Link>
              </div>
            </div>

            {/* In-page Sandbox Terminal */}
            <div className="bg-[#fffef9] border border-[#dbe2d5] rounded-2xl p-5 sm:p-6 shadow-xl">
              <div className="flex items-center justify-between text-[11px] text-[#788174] pb-3 border-b border-[#e8eadf] mb-4">
                <span className="font-bold flex items-center space-x-1.5 text-[#075448]">
                  <span>✳</span>
                  <span>ACME CORP · PUBLIC WORKSPACE</span>
                </span>
                <span className="bg-[#e8f0dc] text-[#24543c] px-2 py-0.5 rounded font-bold text-[10px]">
                  ● LIVE
                </span>
              </div>

              <div className="text-xs font-bold text-[#171a17] mb-2">
                {activeQA.question}
              </div>

              <div className="bg-[#f7f8f1] border border-[#e8eadf] rounded-xl p-4 text-xs leading-relaxed text-[#424840] min-h-[110px]">
                <p className="mb-3">{activeQA.answer}</p>
                <button
                  type="button"
                  onClick={() => setShowCitationDrawer(!showCitationDrawer)}
                  className="inline-flex items-center space-x-1.5 bg-[#e8f0dc] hover:bg-[#dde9ce] border border-[#d7e4c6] text-[#24543c] px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  <span>▤</span>
                  <span>{activeQA.source} · {activeQA.page}</span>
                </button>
              </div>

              {/* Expandable Citation Drawer */}
              {showCitationDrawer && (
                <div className="mt-3 p-3.5 border-l-4 border-[#8bbd47] bg-[#f3f6ed] rounded-r-lg text-xs leading-relaxed text-[#576251] animate-in fade-in duration-200">
                  <strong className="block text-[#171a17] text-[11px] uppercase tracking-wider mb-1">
                    Verified Source Passage · {activeQA.source}
                  </strong>
                  <p className="font-mono text-[11px] bg-white/70 p-2 rounded border border-[#e0e4d7] text-[#424840]">
                    "{activeQA.excerpt}"
                  </p>
                </div>
              )}

              {/* Demo Input Form */}
              <form onSubmit={handleDemoSubmit} className="mt-4 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-[#8a9286]" />
                  <input
                    type="text"
                    value={demoInput}
                    onChange={(e) => setDemoInput(e.target.value)}
                    placeholder="Ask about travel, leave, or security..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-[#dfe4d8] rounded-lg focus:outline-none focus:border-[#075448] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#075448] text-white text-xs font-bold rounded-lg hover:bg-[#0c6657] transition-colors whitespace-nowrap"
                >
                  Ask ↗
                </button>
              </form>

              <div className="flex items-center justify-between mt-3 text-[10px] text-[#8a9286]">
                <span>Sample questions match synthetic Acme Corp policies</span>
                <Link to="/demo" className="text-[#075448] font-bold hover:underline">
                  Go to full chat →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 9. Interactive FAQ Accordion */}
        <section id="faq" className="py-24 px-6 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#748071] block mb-2">
              A few things worth knowing
            </span>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#171a17]">
              Questions,{' '}
              <em className="font-serif italic font-normal text-[#075448]">
                answered.
              </em>
            </h2>
          </div>

          <div className="divide-y divide-[#dce1d5] border-y border-[#dce1d5]">
            {FAQS.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={index} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full py-2 flex items-center justify-between text-left font-semibold text-sm sm:text-base text-[#171a17] hover:text-[#075448] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span
                      className={`text-xl font-normal text-[#075448] transform transition-transform duration-200 ${
                        isOpen ? 'rotate-45' : ''
                      }`}
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pt-2 pb-3 pr-8 text-xs sm:text-sm text-[#70786d] leading-relaxed animate-in fade-in duration-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 10. Final High-Impact CTA Banner */}
        <section className="px-4 sm:px-6 py-6 pb-20">
          <div className="max-w-6xl mx-auto bg-[#075448] text-[#f7f7ed] text-center rounded-3xl p-12 sm:p-20">
            <span className="text-xs font-bold uppercase tracking-widest text-[#c5d5b8] block mb-3">
              Make your company knowledge useful
            </span>
            <h2 className="text-4xl sm:text-6xl md:text-7xl font-medium tracking-tight leading-tight max-w-2xl mx-auto mb-5">
              Stop searching.
              <br />
              <em className="font-serif italic font-normal text-[#d9f078]">
                Start knowing.
              </em>
            </h2>
            <p className="text-sm sm:text-base text-[#d2ddcf] max-w-lg mx-auto mb-8 leading-relaxed">
              Give your team one place to ask questions, verify the exact source passages, and move forward with total confidence.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3.5">
              <Link
                to="/demo"
                className="rounded-full px-7 py-3.5 bg-[#d9f078] hover:bg-[#eef8c6] text-[#075448] text-sm font-bold tracking-tight inline-flex items-center space-x-2 shadow-md transition-all transform hover:-translate-y-0.5"
              >
                <span>Explore public demo</span>
                <span className="text-xs">↗</span>
              </Link>
              <Link
                to="/signup"
                className="rounded-full px-7 py-3.5 bg-[#fffef7] hover:bg-[#f7f7ed] text-[#075448] text-sm font-bold tracking-tight inline-flex items-center space-x-2 shadow-md transition-all transform hover:-translate-y-0.5"
              >
                <span>Create free workspace</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 11. Footer */}
      <footer className="border-t border-[#dfe2d5] bg-[#f7f7ed] py-14 px-6 text-xs text-[#788174]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-10">
          <div className="max-w-xs">
            <Link
              to="/"
              className="flex items-center space-x-2 font-bold text-base text-[#171a17] mb-2"
            >
              <span className="w-6 h-6 rounded bg-[#075448] text-[#d9f078] flex items-center justify-center text-xs font-black">
                ⌘
              </span>
              <span>Citewise</span>
            </Link>
            <p className="leading-relaxed">
              Grounded answers for the knowledge your business already owns. Built with FastAPI, PostgreSQL, and Google Gemini.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 sm:gap-14">
            <div className="space-y-2.5">
              <strong className="block text-[#171a17] text-xs uppercase tracking-wider">
                Product
              </strong>
              <a href="#platform" className="block hover:text-[#075448] transition-colors">
                Platform
              </a>
              <a href="#how-it-works" className="block hover:text-[#075448] transition-colors">
                How it works
              </a>
              <Link to="/demo" className="block hover:text-[#075448] transition-colors">
                Public demo ↗
              </Link>
            </div>

            <div className="space-y-2.5">
              <strong className="block text-[#171a17] text-xs uppercase tracking-wider">
                Trust & Safety
              </strong>
              <a href="#security" className="block hover:text-[#075448] transition-colors">
                Security
              </a>
              <a href="#faq" className="block hover:text-[#075448] transition-colors">
                FAQ
              </a>
              <a href="#security" className="block hover:text-[#075448] transition-colors">
                Grounded retrieval
              </a>
            </div>

            <div className="space-y-2.5 col-span-2 sm:col-span-1">
              <strong className="block text-[#171a17] text-xs uppercase tracking-wider">
                Account & Source
              </strong>
              <Link to="/login" className="block hover:text-[#075448] transition-colors">
                Sign in
              </Link>
              <Link to="/signup" className="block hover:text-[#075448] transition-colors">
                Get started
              </Link>
              <a
                href="https://github.com/RajatDebnth/Citewise"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 hover:text-[#075448] transition-colors"
              >
                <span>GitHub</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-[#dfe2d5] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#8a9185]">
          <span>© {new Date().getFullYear()} Citewise. All rights reserved.</span>
          <span>Built for answers you can verify.</span>
        </div>
      </footer>
    </div>
  );
};
