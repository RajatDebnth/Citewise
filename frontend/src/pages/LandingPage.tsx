import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Menu,
  X,
  ExternalLink,
  Search,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

import {
  Icon3DShield,
  Icon3DDossier,
  Icon3DVault,
  Icon3DPrism,
  Icon3DLightning,
  Icon3DVectorCluster,
  PeepSarah,
  PeepMarcus,
  PeepElena,
  SceneVerificationArt,
} from '../components/landing/ArtAndIcons';

import {
  SpotlightCard,
  TiltCard,
  WaveformVisualizer,
  HighlighterStroke,
  MagneticButton,
} from '../components/landing/MotionComponents';
import { useAuth } from '../hooks/useAuth';

interface DemoQA {
  id: string;
  category: 'hr' | 'finance' | 'security';
  categoryLabel: string;
  keys: string[];
  question: string;
  answer: string;
  source: string;
  page: string;
  section: string;
  excerpt: string;
  highlightedPhrase: string;
}

const DEMO_ANSWERS: DemoQA[] = [
  {
    id: 'travel',
    category: 'finance',
    categoryLabel: 'Finance & Travel',
    keys: ['travel', 'flight', 'trip', 'international', 'hotel'],
    question: 'What is the approval process for international travel?',
    answer:
      'All international travel must be approved by your direct manager before booking on Navan. Flight reservations exceeding $500 USD require explicit pre-approval from the Department VP. Business class is permitted solely for direct routes exceeding 6 continuous flight hours.',
    source: 'Travel & Expense Policy (FIN-SOP-204)',
    page: 'Page 1',
    section: 'Section 1 · Flight Bookings',
    excerpt:
      'All business flights, lodging, and vehicle rentals must be booked exclusively through the Acme Corporate Travel Portal (Navan). Any flight exceeding $500 USD total cost requires written pre-approval from the Department Vice President before ticket issuance.',
    highlightedPhrase: 'requires written pre-approval from the Department Vice President before ticket issuance',
  },
  {
    id: 'leave',
    category: 'hr',
    categoryLabel: 'People & HR',
    keys: ['leave', 'pto', 'vacation', 'time off', 'holiday'],
    question: "What is Acme Corp's annual PTO rollover policy?",
    answer:
      'Full-time employees accrue 20 days of Paid Time Off per calendar year (1.67 days/month). Up to a maximum of 5 unused PTO days can be rolled over into the consecutive calendar year. Any unused days beyond 5 expire on December 31 without payout.',
    source: 'Leave & Attendance SOP (SOP-HR-101)',
    page: 'Page 1',
    section: 'Section 1 · Paid Time Off (PTO) Policy',
    excerpt:
      'Up to a maximum of 5 unused PTO days may be rolled over into the consecutive calendar year. Any additional accrued but unused PTO beyond 5 days will expire on December 31 at midnight without financial compensation.',
    highlightedPhrase: 'Up to a maximum of 5 unused PTO days may be rolled over into the consecutive calendar year',
  },
  {
    id: 'security',
    category: 'security',
    categoryLabel: 'IT & Security',
    keys: ['security', 'password', 'mfa', 'device', 'laptop', 'lost', 'stolen'],
    question: 'How quickly must a lost or stolen laptop be reported?',
    answer:
      'Any loss or theft of an Acme device (laptop, smartphone, or hardware security key) must be reported immediately to the Information Security Operations Center within a maximum of 2 hours at security@acme.example or +1-800-555-ACME.',
    source: 'Information Security Standards (SEC-SOP-302)',
    page: 'Page 1',
    section: 'Section 3 · Incident Response',
    excerpt:
      'In the event of a lost, misplaced, or stolen Acme device, the custodian must notify Information Security immediately and within a maximum of two (2) hours from discovery to initiate an immediate remote cryptographic wipe.',
    highlightedPhrase: 'within a maximum of two (2) hours from discovery to initiate an immediate remote cryptographic wipe',
  },
];

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: 'What file types can I upload?',
    a: 'Citewise supports PDF, DOCX, and TXT documents. It processes employee handbooks, travel guidelines, legal policies, standard operating procedures (SOPs), and engineering specifications up to 10 MB per file with automatic text extraction and chunking.',
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
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'hr' | 'finance' | 'security'>('finance');
  const [selectedDemoIndex, setSelectedDemoIndex] = useState(0);
  const [demoInput, setDemoInput] = useState('');
  const [showCitationDrawer, setShowCitationDrawer] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const activeQA = DEMO_ANSWERS[selectedDemoIndex] || DEMO_ANSWERS[0];

  const handleCategorySwitch = (cat: 'hr' | 'finance' | 'security') => {
    setActiveCategory(cat);
    const foundIdx = DEMO_ANSWERS.findIndex((item) => item.category === cat);
    if (foundIdx !== -1) {
      setSelectedDemoIndex(foundIdx);
    }
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoInput.trim()) return;

    const term = demoInput.toLowerCase();
    const matchIndex = DEMO_ANSWERS.findIndex((qa) =>
      qa.keys.some((k) => term.includes(k)) || qa.question.toLowerCase().includes(term)
    );

    if (matchIndex !== -1) {
      setSelectedDemoIndex(matchIndex);
      setActiveCategory(DEMO_ANSWERS[matchIndex].category);
    } else {
      setSelectedDemoIndex(0);
      setActiveCategory('finance');
    }
    setShowCitationDrawer(true);
  };

  return (
    <div className="min-h-screen bg-paper-grain text-[#171a17] selection:bg-[#d9f078] selection:text-[#075448] font-sans relative overflow-x-clip">
      {/* 1. Top Announcement Bar */}
      <div className="bg-[#075448] text-[#f7f7ed] text-xs font-medium py-2.5 px-4 text-center border-b border-[#04332c] flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        <WaveformVisualizer active={true} color="#d9f078" barCount={7} />
        <span>Strict Grounded RAG · pgvector 768d on Supabase</span>
        <span className="hidden sm:inline text-white/40">|</span>
        <Link
          to="/demo"
          className="inline-flex items-center space-x-1 text-[#d9f078] hover:text-white font-bold transition-colors group"
        >
          <span>Try public demo live</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* 2. Glassmorphic Sticky Navbar with 30% increased height and generous edge spacing */}
      <header className="sticky top-0 z-50 w-full bg-[#f7f7ed]/92 backdrop-blur-md border-b border-[#dfe2d5]/90 shadow-[0_4px_24px_-4px_rgba(23,26,23,0.06)] transition-all">
        <nav className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 h-20 sm:h-[88px] flex items-center justify-between">
          {/* Logo with 3D brand badge and ample margin from edge */}
          <Link to="/" className="flex items-center space-x-3 group py-2">
            <motion.div
              whileHover={{ rotate: 12, scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 350 }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#075448] text-[#d9f078] flex items-center justify-center font-black text-sm sm:text-base shadow-sm"
            >
              ⌘
            </motion.div>
            <span className="font-bold text-lg sm:text-xl tracking-tight text-[#171a17]">
              Citewise
            </span>
            <span className="hidden sm:inline-block text-[10px] font-bold tracking-widest uppercase bg-[#e9eee2] text-[#425042] px-2.5 py-0.5 rounded-full border border-[#cbd4c0]">
              v1.0
            </span>
          </Link>

          {/* Desktop Nav Links with spacious margins and generous breathing room */}
          <div className="hidden md:flex items-center space-x-7 lg:space-x-9 text-sm font-medium text-[#495147]">
            <a href="#platform" className="px-3 py-1.5 rounded-full hover:text-[#075448] hover:bg-[#075448]/5 transition-all">
              Platform
            </a>
            <a href="#humanity" className="px-3 py-1.5 rounded-full hover:text-[#075448] hover:bg-[#075448]/5 transition-all">
              People
            </a>
            <a href="#security" className="px-3 py-1.5 rounded-full hover:text-[#075448] hover:bg-[#075448]/5 transition-all">
              Trust & Safety
            </a>
            <a href="#how-it-works" className="px-3 py-1.5 rounded-full hover:text-[#075448] hover:bg-[#075448]/5 transition-all">
              How it works
            </a>
            <a href="#faq" className="px-3 py-1.5 rounded-full hover:text-[#075448] hover:bg-[#075448]/5 transition-all">
              FAQ
            </a>
            <Link
              to="/demo"
              className="text-[#075448] font-bold inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-[#075448]/8 hover:bg-[#075448]/15 transition-all"
            >
              <span>Public Demo</span>
              <span className="text-xs">↗</span>
            </Link>
          </div>

          {/* Nav Actions with comfortable padding and edge separation */}
          <div className="hidden md:flex items-center space-x-4 pl-4">
            {user ? (
              <Link to="/app">
                <MagneticButton className="px-6 py-3 text-xs font-bold uppercase tracking-wider bg-[#075448] hover:bg-[#0c6657] text-[#fffef7] rounded-full shadow-sm inline-flex items-center space-x-2">
                  <span>Go to Workspaces</span>
                  <span>→</span>
                </MagneticButton>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-5 py-2.5 text-sm font-semibold text-[#171a17] hover:text-[#075448] transition-colors"
                >
                  Sign in
                </Link>
                <Link to="/signup">
                  <MagneticButton className="px-6 py-3 text-xs font-bold uppercase tracking-wider bg-[#075448] hover:bg-[#0c6657] text-[#fffef7] rounded-full shadow-sm">
                    Get started ↗
                  </MagneticButton>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[#171a17] hover:bg-[#dfe2d5]/60 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-b border-[#171a17]/10 bg-[#f7f7ed] px-6 py-4 space-y-3 overflow-hidden"
            >
              <a
                href="#platform"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium py-1.5 text-[#424840]"
              >
                Platform
              </a>
              <a
                href="#humanity"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium py-1.5 text-[#424840]"
              >
                People
              </a>
              <a
                href="#security"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium py-1.5 text-[#424840]"
              >
                Trust & safety
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium py-1.5 text-[#424840]"
              >
                How it works
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
                className="block text-sm font-medium py-1.5 text-[#075448] font-bold"
              >
                Public Demo ↗
              </Link>
              <div className="pt-3 border-t border-[#171a17]/10 flex flex-col gap-2">
                {user ? (
                  <Link
                    to="/app"
                    className="w-full text-center py-2 text-sm font-bold bg-[#075448] text-white rounded-lg"
                  >
                    Go to Workspaces →
                  </Link>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* 3. Hero Section with Wispr Flow Motion & 3D Icons */}
        <section className="relative overflow-hidden pt-14 pb-16 sm:pt-20 sm:pb-24 text-center px-6">
          <div className="max-w-4xl mx-auto relative z-10">
            {/* Pill Eyebrow with animated sound wave */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center space-x-2.5 border border-[#d2d9c8] rounded-full px-4 py-1.5 bg-[#fffef9] text-[#334235] text-xs font-semibold tracking-wider uppercase mb-7 shadow-xs"
            >
              <WaveformVisualizer active={true} color="#075448" barCount={6} />
              <span>Grounded Knowledge Assistant</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#8bbd47]" />
              <span className="text-[11px] text-[#697465]">No Hallucinations</span>
            </motion.div>

            {/* Headline with Highlighter Stroke */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl sm:text-7xl md:text-8xl font-medium tracking-tight leading-[0.98] text-[#171a17] mb-6"
            >
              Your company knowledge.
              <br />
              <HighlighterStroke color="#d9f078" className="mt-1">
                <em className="font-serif italic font-normal text-[#075448]">
                  Finally trustworthy.
                </em>
              </HighlighterStroke>
            </motion.h1>

            {/* Editorial Copy */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-2xl mx-auto text-[#596158] text-lg sm:text-xl leading-relaxed mb-9"
            >
              Ask complex questions across your internal documents. Receive clear, grounded answers backed by direct database citations—never plausible fabrications.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center justify-center gap-3.5 mb-4"
            >
              <Link to="/demo">
                <MagneticButton className="px-7 py-3.5 bg-[#075448] hover:bg-[#0c6657] text-[#fffef7] text-sm font-bold tracking-tight inline-flex items-center space-x-2 rounded-full shadow-md hover:shadow-lg transition-all">
                  <span>Try the interactive demo</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </MagneticButton>
              </Link>
              <a
                href="#platform"
                className="rounded-full px-6 py-3.5 border border-[#aeb8a9] hover:bg-[#dfe2d5]/50 text-[#171a17] text-sm font-semibold tracking-tight inline-flex items-center transition-colors bg-white/40"
              >
                Explore platform architecture
              </a>
            </motion.div>

            <p className="text-xs text-[#7a8076]">
              No sign-up or credit card required · Instant Acme Corp policy corpus
            </p>
          </div>

          {/* Interactive Hero Stage (Concentric Orbit Rings & 3D Badges) */}
          <div className="max-w-5xl mx-auto mt-12 sm:mt-16 relative min-h-[480px] flex items-center justify-center">
            {/* Wispr Flow Concentric Motion Rings */}
            <div className="absolute w-[94vw] max-w-[880px] h-[370px] border border-[#dfe3d6] rounded-full rotate-[-7deg] pointer-events-none" />
            <div className="absolute w-[82vw] max-w-[740px] h-[310px] border border-[#e5e7dc] rounded-full rotate-[11deg] pointer-events-none" />

            {/* Left 3D Floating Motion Badge (ReactBits style) */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="hidden lg:flex absolute left-2 top-14 z-20"
            >
              <div className="animate-float-left bg-[#fffef9]/95 backdrop-blur-md border border-[#cbd5be] rounded-2xl p-4 shadow-xl flex items-center space-x-3.5 max-w-[230px] text-left">
                <Icon3DShield className="w-11 h-11 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#075448]">
                    Strict Gate
                  </div>
                  <div className="text-xs font-bold text-[#171a17]">
                    Zero Hallucination
                  </div>
                  <div className="text-[10px] text-[#717b6f] mt-0.5">
                    Threshold: score ≥ 0.50
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right 3D Floating Motion Badge (ReactBits style) */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="hidden lg:flex absolute right-2 bottom-12 z-20"
            >
              <div className="animate-float-right bg-[#fffef9]/95 backdrop-blur-md border border-[#cbd5be] rounded-2xl p-4 shadow-xl flex items-center space-x-3.5 max-w-[240px] text-left">
                <Icon3DVectorCluster className="w-11 h-11 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#075448]">
                    pgvector 768d
                  </div>
                  <div className="text-xs font-bold text-[#171a17]">
                    Multi-Tenant Isolation
                  </div>
                  <div className="text-[10px] text-[#717b6f] mt-0.5">
                    Scoped PostgreSQL RLS
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Central TiltCard Product Window Preview */}
            <TiltCard className="w-full max-w-3xl relative z-10" maxAngle={6}>
              <div className="bg-[#fffef9] border border-[#d6dcce] rounded-3xl p-5 sm:p-7 shadow-2xl text-left">
                {/* Window Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#ecefe7] mb-5">
                  <div className="flex items-center space-x-3">
                    <div className="flex space-x-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#e38c7f]" />
                      <div className="w-3 h-3 rounded-full bg-[#f3cb69]" />
                      <div className="w-3 h-3 rounded-full bg-[#75c689]" />
                    </div>
                    <span className="text-xs font-bold text-[#4c564b] flex items-center space-x-1.5">
                      <span className="text-[#075448]">✦</span>
                      <span>Acme Corp Knowledge Hub</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-[#075448] font-bold bg-[#edf4e6] px-2.5 py-1 rounded-full border border-[#d9e6ce]">
                    <span className="w-2 h-2 rounded-full bg-[#8bbd47] animate-pulse" />
                    <span>3 Documents Synced</span>
                  </div>
                </div>

                {/* User Prompt */}
                <div className="mb-4">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#798376] mb-1.5">
                    User Question
                  </div>
                  <div className="bg-[#f5f7ee] border border-[#e3e8dc] rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-[#171a17] flex items-center justify-between">
                    <span>"{activeQA.question}"</span>
                    <span className="text-[10px] bg-[#dce5d3] text-[#3d503f] font-bold px-2 py-0.5 rounded">
                      Cosine 0.92
                    </span>
                  </div>
                </div>

                {/* Grounded Assistant Answer */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-[#075448] mb-1.5">
                    <span className="flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Verified Assistant Response</span>
                    </span>
                    <span className="text-[#647161]">Gemini 2.5 Flash</span>
                  </div>
                  <div className="bg-[#fffef9] border border-[#d8e0ce] rounded-xl p-4 text-xs sm:text-sm leading-relaxed text-[#353c34]">
                    <p className="mb-3">{activeQA.answer}</p>
                    {/* Clickable Citation Pill */}
                    <button
                      type="button"
                      onClick={() => setShowCitationDrawer(!showCitationDrawer)}
                      className="inline-flex items-center space-x-2 bg-[#edf4e6] hover:bg-[#e1ecd6] border border-[#d3e2c5] text-[#075448] px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs group"
                    >
                      <Icon3DDossier className="w-4 h-4 shrink-0" />
                      <span>{activeQA.source} · {activeQA.page}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#075448] transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>

                {/* Animated Citation Highlighter Drawer */}
                <AnimatePresence>
                  {showCitationDrawer && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden mb-4"
                    >
                      <div className="p-4 bg-[#f4f7ee] border-l-4 border-[#8bbd47] rounded-r-xl border-y border-r border-[#dfe6d6] text-xs leading-relaxed text-[#455042]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-[#075448] uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                            <Check className="w-3.5 h-3.5 text-[#075448]" />
                            <span>Database Verified Passage · {activeQA.section}</span>
                          </span>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#dfe4d8] font-mono">
                            chunk_id: #89c30d
                          </span>
                        </div>
                        <p className="font-mono text-[11px] bg-white/90 p-3 rounded-lg border border-[#e2e7da] text-[#2c342b]">
                          "{activeQA.excerpt.replace(activeQA.highlightedPhrase, '')}
                          <mark className="bg-[#d9f078] text-[#075448] px-1 py-0.5 rounded font-bold font-mono">
                            {activeQA.highlightedPhrase}
                          </mark>
                          ."
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bottom Action Footer */}
                <div className="pt-3 border-t border-[#ecefe7] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#717b6f]">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-[#8bbd47]" />
                    <span>Real-time vector lookup via pgvector on Supabase</span>
                  </div>
                  <Link
                    to="/demo"
                    className="text-[#075448] font-bold hover:underline inline-flex items-center space-x-1"
                  >
                    <span>Launch interactive full demo</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </TiltCard>
          </div>
        </section>

        {/* 4. Infinite Animated Marquee Ticker (ReactBits style) */}
        <section className="border-y border-[#dfe2d5] bg-[#fffef9] py-4.5 overflow-hidden">
          <div className="animate-marquee flex items-center gap-10 whitespace-nowrap text-xs font-bold tracking-wider uppercase text-[#4c564b]">
            <span className="flex items-center gap-2">
              <span className="text-[#8bbd47]">●</span> Grounding before generation
            </span>
            <span className="flex items-center gap-2">
              <Icon3DShield className="w-4 h-4" /> Zero hallucination fallback gate
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#8bbd47]">●</span> Direct database page citations
            </span>
            <span className="flex items-center gap-2">
              <Icon3DVectorCluster className="w-4 h-4" /> 768-dimensional embeddings
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#8bbd47]">●</span> Multi-tenant Postgres RLS
            </span>
            <span className="flex items-center gap-2">
              <Icon3DLightning className="w-4 h-4" /> Gemini 2.5 Flash reasoning
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#8bbd47]">●</span> Magic-byte upload validation
            </span>
            {/* Duplicated for seamless loop */}
            <span className="flex items-center gap-2">
              <span className="text-[#8bbd47]">●</span> Grounding before generation
            </span>
            <span className="flex items-center gap-2">
              <Icon3DShield className="w-4 h-4" /> Zero hallucination fallback gate
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#8bbd47]">●</span> Direct database page citations
            </span>
            <span className="flex items-center gap-2">
              <Icon3DVectorCluster className="w-4 h-4" /> 768-dimensional embeddings
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#8bbd47]">●</span> Multi-tenant Postgres RLS
            </span>
          </div>
        </section>

        {/* 5. Human Characters & Open Peeps Section (Warmth, Art & Craft) */}
        <section id="humanity" className="py-24 px-6 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#748071] block mb-2">
              Designed for real teams
            </span>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#171a17] mb-4">
              Answers people can{' '}
              <em className="font-serif italic font-normal text-[#075448]">
                stake their work on.
              </em>
            </h2>
            <p className="text-sm sm:text-base text-[#687166] leading-relaxed">
              When internal teams rely on AI, "mostly accurate" isn't enough. People Ops, Finance, and Engineering need citations they can audit in two seconds.
            </p>
          </div>

          {/* Editorial Hand-Drawn Scene Art (unDraw / Open Peeps style) */}
          <div className="mb-16 bg-[#f3f6ec] border border-[#dce3d4] rounded-3xl p-6 sm:p-10 shadow-inner flex items-center justify-center">
            <SceneVerificationArt className="w-full max-w-2xl h-auto" />
          </div>

          {/* Open Peeps Character Quotes */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Peep 1: People Ops */}
            <SpotlightCard className="bg-[#fffef9] border border-[#dbe2d5] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center space-x-3.5 mb-4">
                <PeepSarah className="w-14 h-14 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-[#171a17]">Sarah L.</h4>
                  <p className="text-xs text-[#707b6e]">Head of People Operations</p>
                </div>
              </div>
              <p className="text-xs text-[#525a50] leading-relaxed italic mb-4">
                "No more answering the exact same 40 PTO and bereavement questions on Slack every Friday. Citewise gives our team the exact handbook page and paragraph."
              </p>
              <div className="pt-3 border-t border-[#edf0e7] flex items-center justify-between text-[11px] text-[#075448] font-bold">
                <span>Verified: HR SOP-101</span>
                <span>100% Grounded</span>
              </div>
            </SpotlightCard>

            {/* Peep 2: Finance */}
            <SpotlightCard className="bg-[#fffef9] border border-[#dbe2d5] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center space-x-3.5 mb-4">
                <PeepMarcus className="w-14 h-14 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-[#171a17]">Marcus T.</h4>
                  <p className="text-xs text-[#707b6e]">VP Finance & Compliance</p>
                </div>
              </div>
              <p className="text-xs text-[#525a50] leading-relaxed italic mb-4">
                "The zero-hallucination gate is the difference between an AI tool we can trust during our financial audits and an expensive legal liability."
              </p>
              <div className="pt-3 border-t border-[#edf0e7] flex items-center justify-between text-[11px] text-[#075448] font-bold">
                <span>Verified: Travel FIN-204</span>
                <span>Strict Refusal</span>
              </div>
            </SpotlightCard>

            {/* Peep 3: Security */}
            <SpotlightCard className="bg-[#fffef9] border border-[#dbe2d5] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center space-x-3.5 mb-4">
                <PeepElena className="w-14 h-14 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-[#171a17]">Elena R.</h4>
                  <p className="text-xs text-[#707b6e]">Principal Security Architect</p>
                </div>
              </div>
              <p className="text-xs text-[#525a50] leading-relaxed italic mb-4">
                "Row-level security on PostgreSQL and isolated workspace queries gave our Infosec committee the confidence to approve deployment on day one."
              </p>
              <div className="pt-3 border-t border-[#edf0e7] flex items-center justify-between text-[11px] text-[#075448] font-bold">
                <span>Verified: SEC-SOP-302</span>
                <span>Postgres RLS</span>
              </div>
            </SpotlightCard>
          </div>
        </section>

        {/* 6. Interactive Category Showcase with Motion Primitives Tabs */}
        <section id="platform" className="py-20 px-6 max-w-6xl mx-auto border-t border-[#dfe2d5]">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-[#748071] block mb-2">
              Cross-Functional Intelligence
            </span>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#171a17] mb-4">
              Explore your policies by{' '}
              <em className="font-serif italic font-normal text-[#075448]">
                department.
              </em>
            </h2>
            <p className="text-sm text-[#687166]">
              Click any department below to test how Citewise retrieves grounded evidence.
            </p>
          </div>

          {/* Animated Tab Bar (Motion-Primitives layoutId) */}
          <div className="flex items-center justify-center gap-2 mb-10">
            <div className="bg-[#e9eee2] p-1.5 rounded-full border border-[#cbd5c0] flex items-center gap-1">
              {(
                [
                  { id: 'finance', label: '💳 Finance & Travel' },
                  { id: 'hr', label: '📁 People & HR' },
                  { id: 'security', label: '🛡️ IT & Security' },
                ] as const
              ).map((tab) => {
                const isActive = activeCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleCategorySwitch(tab.id)}
                    className="relative px-4 sm:px-6 py-2 text-xs font-bold rounded-full transition-colors cursor-pointer"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeCategoryPill"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="absolute inset-0 bg-[#075448] rounded-full shadow-sm"
                      />
                    )}
                    <span
                      className={`relative z-10 transition-colors ${
                        isActive ? 'text-[#fffef7]' : 'text-[#475245] hover:text-[#075448]'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Department Feature Split */}
          <div className="grid lg:grid-cols-12 gap-8 items-center bg-[#fffef9] border border-[#dbe2d5] rounded-3xl p-6 sm:p-10 shadow-lg">
            <div className="lg:col-span-5 space-y-5">
              <span className="inline-block bg-[#edf4e6] text-[#075448] text-[11px] font-bold px-3 py-1 rounded-full border border-[#d6e3cd]">
                Department: {activeQA.categoryLabel}
              </span>
              <h3 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#171a17]">
                "{activeQA.question}"
              </h3>
              <p className="text-xs sm:text-sm text-[#687166] leading-relaxed">
                {activeQA.answer}
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCitationDrawer(!showCitationDrawer)}
                  className="inline-flex items-center space-x-2 text-xs font-bold text-[#075448] bg-[#d9f078]/40 hover:bg-[#d9f078]/70 border border-[#c4dc6a] px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Icon3DDossier className="w-4 h-4 shrink-0" />
                  <span>Inspect Source: {activeQA.source}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Visual 3D Stack */}
            <div className="lg:col-span-7 bg-[#e8eddf] rounded-2xl p-6 sm:p-8 relative overflow-hidden flex items-center justify-center min-h-[300px]">
              <div className="w-full max-w-md bg-[#fffef9] border border-[#d4dcce] rounded-xl p-5 shadow-md">
                <div className="flex items-center justify-between text-[11px] text-[#717b6e] font-mono pb-2 border-b border-[#e8ece3] mb-3">
                  <span>POSTGRES CHUNK #01</span>
                  <span className="text-[#075448] font-bold">COSINE: 0.92</span>
                </div>
                <div className="text-xs font-mono text-[#2f372d] bg-[#f7f8f2] p-3 rounded border border-[#dfe4da] leading-relaxed">
                  "{activeQA.excerpt}"
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-[#717b6e]">
                  <span>{activeQA.source}</span>
                  <span className="bg-[#e9eee2] px-2 py-0.5 rounded font-bold text-[#075448]">
                    {activeQA.page}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Trust is the Architecture (Deep Forest Green with 3D Icons & SpotlightCards) */}
        <section id="security" className="px-4 sm:px-6 py-10">
          <div className="max-w-6xl mx-auto bg-[#075448] text-[#f7f7ed] rounded-3xl p-8 sm:p-14 md:p-16 relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#d9f078] opacity-10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl mb-12 relative z-10">
              <span className="text-xs font-bold uppercase tracking-widest text-[#d9f078] block mb-2">
                Enterprise-grade architecture
              </span>
              <h2 className="text-4xl sm:text-5xl font-medium tracking-tight leading-tight text-white mb-4">
                Designed to protect the{' '}
                <em className="font-serif italic font-normal text-[#d9f078]">
                  integrity of every answer.
                </em>
              </h2>
              <p className="text-[#d0dbce] text-sm sm:text-base leading-relaxed">
                From document ingestion to final citation reconstruction, every layer is engineered to stop hallucinations, enforce multi-tenant isolation, and validate untrusted input.
              </p>
            </div>

            {/* Trust 6-Card Grid with 3D Icons & ReactBits Spotlight */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 relative z-10">
              {/* Card 1 */}
              <SpotlightCard
                spotlightColor="rgba(217, 240, 120, 0.22)"
                className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all"
              >
                <div className="mb-5">
                  <Icon3DShield className="w-12 h-12" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Zero-hallucination gate
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  If the top similarity falls below the 0.50 threshold, the model is never invoked. The assistant declines and logs the question to an unanswered queue.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  Strict threshold fallback
                </span>
              </SpotlightCard>

              {/* Card 2 */}
              <SpotlightCard
                spotlightColor="rgba(217, 240, 120, 0.22)"
                className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all"
              >
                <div className="mb-5">
                  <Icon3DDossier className="w-12 h-12" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Verifiable citations
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  Every citation is reconstructed from stored document chunks and metadata—never generated or hallucinated by the language model.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  Database-backed sources
                </span>
              </SpotlightCard>

              {/* Card 3 */}
              <SpotlightCard
                spotlightColor="rgba(217, 240, 120, 0.22)"
                className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all"
              >
                <div className="mb-5">
                  <Icon3DVault className="w-12 h-12" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Multi-tenant isolation
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  Workspace-scoped queries and PostgreSQL row-level security keep every organization's knowledge completely isolated. Non-members receive a 404.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  404 for non-members
                </span>
              </SpotlightCard>

              {/* Card 4 */}
              <SpotlightCard
                spotlightColor="rgba(217, 240, 120, 0.22)"
                className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all"
              >
                <div className="mb-5">
                  <Icon3DPrism className="w-12 h-12" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Resilient ingestion
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  PDF, DOCX, and TXT parsing creates semantic chunks. A SHA-256 content-hash cache avoids repeated embedding compute for identical content.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  Deduplicated indexing
                </span>
              </SpotlightCard>

              {/* Card 5 */}
              <SpotlightCard
                spotlightColor="rgba(217, 240, 120, 0.22)"
                className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all"
              >
                <div className="mb-5">
                  <Icon3DLightning className="w-12 h-12" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Hardened uploads
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  Streaming size caps (10 MB) and magic-byte signature checks reject forged files, password-protected PDFs, zip bombs, and unsafe paths.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  10 MB streaming limit
                </span>
              </SpotlightCard>

              {/* Card 6 */}
              <SpotlightCard
                spotlightColor="rgba(217, 240, 120, 0.22)"
                className="bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl p-6 transition-all"
              >
                <div className="mb-5">
                  <Icon3DVectorCluster className="w-12 h-12" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  Prompt injection guard
                </h4>
                <p className="text-xs text-[#d0dbce] leading-relaxed">
                  Retrieved text is strictly isolated in untrusted source blocks. Rigid JSON schema validation keeps model responses safely within bounds.
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold tracking-wider uppercase text-[#d9f078]">
                  Controlled generation
                </span>
              </SpotlightCard>
            </div>
          </div>
        </section>

        {/* 8. How It Works ("From Documents to Decisions") */}
        <section id="how-it-works" className="py-24 px-6 max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#748071] block mb-2">
              From documents to decisions
            </span>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#171a17] mb-4">
              Three steps.{' '}
              <em className="font-serif italic font-normal text-[#075448]">
                One reliable answer.
              </em>
            </h2>
            <p className="text-sm text-[#687166]">
              Bring your existing documents together and make them searchable with natural language.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <SpotlightCard className="bg-[#fffef9] border border-[#dbe2d5] rounded-2xl p-8 relative">
              <span className="font-serif text-3xl text-[#075448] font-normal block mb-4">
                01
              </span>
              <h3 className="text-lg font-bold text-[#171a17] mb-2">
                Upload your documents
              </h3>
              <p className="text-xs text-[#6e776b] leading-relaxed mb-6">
                Drop your PDF, DOCX, or TXT files. Citewise cleans the text, extracts sections, and creates semantic vector chunks.
              </p>
              <div className="bg-[#f5f7ee] border border-[#e2e7da] rounded-xl p-3 text-[11px] text-[#425042] flex items-center justify-between">
                <span>Handbook_2026.pdf</span>
                <span className="bg-[#e4eed7] text-[#075448] px-2 py-0.5 rounded font-bold text-[10px]">
                  Ready · 42 Chunks
                </span>
              </div>
            </SpotlightCard>

            {/* Step 2 */}
            <SpotlightCard className="bg-[#fffef9] border border-[#dbe2d5] rounded-2xl p-8 relative">
              <span className="font-serif text-3xl text-[#075448] font-normal block mb-4">
                02
              </span>
              <h3 className="text-lg font-bold text-[#171a17] mb-2">
                Ask in plain English
              </h3>
              <p className="text-xs text-[#6e776b] leading-relaxed mb-6">
                Your question is embedded and searched across your workspace chunks using cosine similarity in pgvector.
              </p>
              <div className="bg-[#f5f7ee] border border-[#e2e7da] rounded-xl p-3 text-[11px] text-[#425042]">
                <div className="text-[10px] text-[#717b6e]">Embedding Search:</div>
                <div className="font-bold">Cosine score: 0.941 &gt; 0.50 threshold</div>
              </div>
            </SpotlightCard>

            {/* Step 3 */}
            <SpotlightCard className="bg-[#fffef9] border border-[#dbe2d5] rounded-2xl p-8 relative">
              <span className="font-serif text-3xl text-[#075448] font-normal block mb-4">
                03
              </span>
              <h3 className="text-lg font-bold text-[#171a17] mb-2">
                Verify the exact citation
              </h3>
              <p className="text-xs text-[#6e776b] leading-relaxed mb-6">
                Get an answer backed by clickable citation chips showing the source title, page number, and paragraph excerpt.
              </p>
              <div className="bg-[#f5f7ee] border border-[#e2e7da] rounded-xl p-3 text-[11px] text-[#425042] flex items-center space-x-2">
                <span className="bg-[#075448] text-[#d9f078] px-1.5 py-0.5 rounded font-bold text-[10px]">
                  [1]
                </span>
                <span>Travel SOP · Page 1 · Flight Bookings</span>
              </div>
            </SpotlightCard>
          </div>
        </section>

        {/* 9. Interactive Live Demo Sandbox Terminal */}
        <section className="py-16 px-6 max-w-5xl mx-auto">
          <div className="bg-[#eef3e6] border border-[#d4deca] rounded-3xl p-6 sm:p-10 shadow-md">
            <div className="text-center max-w-xl mx-auto mb-8">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#075448] block mb-1.5">
                Live Interactive Sandbox
              </span>
              <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#171a17]">
                Try asking a question{' '}
                <em className="font-serif italic font-normal text-[#075448]">
                  right now.
                </em>
              </h2>
            </div>

            {/* In-page Sandbox Terminal */}
            <div className="bg-[#fffef9] border border-[#dbe2d5] rounded-2xl p-5 sm:p-7 shadow-xl">
              <div className="flex items-center justify-between text-[11px] text-[#788174] pb-3 border-b border-[#e8eadf] mb-4">
                <span className="font-bold flex items-center space-x-1.5 text-[#075448]">
                  <WaveformVisualizer active={true} color="#075448" barCount={5} />
                  <span>ACME CORP · PUBLIC WORKSPACE</span>
                </span>
                <span className="bg-[#e8f0dc] text-[#24543c] px-2.5 py-0.5 rounded-full font-bold text-[10px] border border-[#d2dfc2]">
                  ● LIVE BACKEND
                </span>
              </div>

              <div className="text-xs font-bold text-[#171a17] mb-2 flex items-center justify-between">
                <span>{activeQA.question}</span>
                <span className="text-[10px] text-[#717b6e] font-normal">
                  Category: {activeQA.categoryLabel}
                </span>
              </div>

              <div className="bg-[#f7f8f1] border border-[#e8eadf] rounded-xl p-4 text-xs leading-relaxed text-[#424840] min-h-[100px]">
                <p className="mb-3">{activeQA.answer}</p>
                <button
                  type="button"
                  onClick={() => setShowCitationDrawer(!showCitationDrawer)}
                  className="inline-flex items-center space-x-1.5 bg-[#e8f0dc] hover:bg-[#dde9ce] border border-[#d7e4c6] text-[#24543c] px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  <Icon3DDossier className="w-3.5 h-3.5 shrink-0" />
                  <span>{activeQA.source} · {activeQA.page}</span>
                </button>
              </div>

              {/* Expandable Citation Drawer */}
              <AnimatePresence>
                {showCitationDrawer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-3"
                  >
                    <div className="p-3.5 border-l-4 border-[#8bbd47] bg-[#f3f6ed] rounded-r-lg text-xs leading-relaxed text-[#576251]">
                      <strong className="block text-[#171a17] text-[11px] uppercase tracking-wider mb-1">
                        Verified Source Passage · {activeQA.source}
                      </strong>
                      <p className="font-mono text-[11px] bg-white/80 p-2 rounded border border-[#e0e4d7] text-[#424840]">
                        "{activeQA.excerpt}"
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick Prompt Chips */}
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <span className="text-[11px] text-[#717b6e] font-semibold">Try prompt:</span>
                {DEMO_ANSWERS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedDemoIndex(idx);
                      setActiveCategory(item.category);
                      setShowCitationDrawer(false);
                    }}
                    className={`text-[11px] px-3 py-1 rounded-full border transition-all ${
                      selectedDemoIndex === idx
                        ? 'bg-[#075448] text-white border-[#075448] font-bold'
                        : 'bg-white hover:bg-[#f1f4eb] text-[#495447] border-[#d8dfcf]'
                    }`}
                  >
                    {item.id === 'travel' && '✈️ Travel Approval'}
                    {item.id === 'leave' && '🏖️ PTO Rollover'}
                    {item.id === 'security' && '🔒 Lost Laptop'}
                  </button>
                ))}
              </div>

              {/* Demo Input Form */}
              <form onSubmit={handleDemoSubmit} className="mt-4 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-[#8a9286]" />
                  <input
                    type="text"
                    value={demoInput}
                    onChange={(e) => setDemoInput(e.target.value)}
                    placeholder="Search travel, PTO rollover, or device security..."
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
                <span>Matches real synthetic Acme Corp documents</span>
                <Link to="/demo" className="text-[#075448] font-bold hover:underline">
                  Launch full interactive chat →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 10. Interactive FAQ Accordion */}
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
                    className="w-full py-2 flex items-center justify-between text-left font-semibold text-sm sm:text-base text-[#171a17] hover:text-[#075448] transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xl font-normal text-[#075448] shrink-0 ml-4"
                    >
                      +
                    </motion.span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2 pb-3 pr-8 text-xs sm:text-sm text-[#70786d] leading-relaxed">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* 11. Final High-Impact CTA Banner */}
        <section className="px-4 sm:px-6 py-8 pb-20">
          <div className="max-w-6xl mx-auto bg-[#075448] text-[#f7f7ed] text-center rounded-3xl p-12 sm:p-20 relative overflow-hidden">
            <div className="max-w-2xl mx-auto relative z-10">
              <span className="text-xs font-bold uppercase tracking-widest text-[#d9f078] block mb-3">
                Make your company knowledge useful
              </span>
              <h2 className="text-4xl sm:text-6xl md:text-7xl font-medium tracking-tight leading-tight mb-5">
                Stop searching.
                <br />
                <em className="font-serif italic font-normal text-[#d9f078]">
                  Start knowing.
                </em>
              </h2>
              <p className="text-sm sm:text-base text-[#d2ddcf] max-w-lg mx-auto mb-8 leading-relaxed">
                Give your team one place to ask questions, verify exact source passages, and move forward with total confidence.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3.5">
                {user ? (
                  <Link to="/app">
                    <MagneticButton className="px-7 py-3.5 bg-[#d9f078] hover:bg-[#eef8c6] text-[#075448] text-sm font-bold tracking-tight inline-flex items-center space-x-2 rounded-full shadow-md">
                      <span>Open your workspaces</span>
                      <span className="text-xs">→</span>
                    </MagneticButton>
                  </Link>
                ) : (
                  <>
                    <Link to="/demo">
                      <MagneticButton className="px-7 py-3.5 bg-[#d9f078] hover:bg-[#eef8c6] text-[#075448] text-sm font-bold tracking-tight inline-flex items-center space-x-2 rounded-full shadow-md">
                        <span>Explore public demo</span>
                        <span className="text-xs">↗</span>
                      </MagneticButton>
                    </Link>
                    <Link to="/signup">
                      <MagneticButton className="px-7 py-3.5 bg-[#fffef7] hover:bg-[#f7f7ed] text-[#075448] text-sm font-bold tracking-tight inline-flex items-center space-x-2 rounded-full shadow-md">
                        <span>Create free workspace</span>
                      </MagneticButton>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 12. Editorial Footer */}
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
                Security architecture
              </a>
              <a href="#humanity" className="block hover:text-[#075448] transition-colors">
                Team testimonials
              </a>
              <a href="#faq" className="block hover:text-[#075448] transition-colors">
                FAQ
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
          <span>Zero hallucination · 100% database verified citations.</span>
        </div>
      </footer>
    </div>
  );
};
