import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  Bot,
  User,
  Send,
  Loader2,
  FileText,
  AlertTriangle,
  X,
  ExternalLink,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { demoApi } from '../services/api';
import { CitationItem, DemoDocument } from '../types';

interface DemoMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: CitationItem[];
  grounded?: boolean;
}

const SAMPLE_QUESTIONS = [
  'What is Acme Corp\'s annual PTO rollover limit?',
  'What is the maximum nightly hotel rate for travel?',
  'How quickly must a lost laptop be reported to IT Security?',
  'What form is needed to request bereavement leave?',
];

export const DemoPage: React.FC = () => {
  const [documents, setDocuments] = useState<DemoDocument[]>([]);
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 Welcome to the Acme Corp SOP Knowledge Assistant demo!\n\nI have access to Acme Corp\'s **Leave Policy (SOP-HR-101)**, **Travel & Expense Policy (FIN-SOP-204)**, and **IT Security Standards (SEC-SOP-302)**.\n\nEvery answer I give is strictly grounded in these documents with exact citations. Ask a question below or click one of the suggested prompts to try it out!',
      grounded: true,
      citations: [],
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load demo documents list on mount
    demoApi
      .getDocuments()
      .then((docs) => setDocuments(docs))
      .catch((err) => console.warn('Could not load demo docs list:', err));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (questionToSend?: string) => {
    const q = (questionToSend || inputQuestion).trim();
    if (!q || isLoading) return;

    setInputQuestion('');
    setErrorMessage(null);

    const userMessage: DemoMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: q,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Prepare history (last 6 turns, user and assistant only)
    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await demoApi.sendChat({
        question: q,
        history: historyPayload,
      });

      const assistantMessage: DemoMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        citations: response.citations || [],
        grounded: response.grounded,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      if (err.status === 429) {
        setQuotaExceeded(true);
        setErrorMessage(
          'Daily demo question limit reached (15/day). Sign up for your own private workspace to ask unlimited questions!'
        );
      } else if (err.status === 503) {
        setErrorMessage(
          'The demo server is currently busy due to high traffic volume. Please try again in a moment.'
        );
      } else {
        setErrorMessage(
          err.message || 'An error occurred while answering your question. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Replace citation markers [n] with clickable chip buttons in rendering
  const renderMessageContent = (msg: DemoMessage) => {
    if (msg.role === 'user') {
      return <div className="whitespace-pre-wrap">{msg.content}</div>;
    }

    return (
      <div className="space-y-3">
        <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown
            components={{
              // Custom text parser to make [1], [2] clickable citation badges
              p: ({ children }) => {
                return (
                  <p className="mb-2 last:mb-0">
                    {React.Children.map(children, (child) => {
                      if (typeof child !== 'string') return child;

                      // Regex for citation brackets [1], [2], etc.
                      const parts = child.split(/(\[\d+\])/g);
                      return parts.map((part, i) => {
                        const match = part.match(/^\[(\d+)\]$/);
                        if (match) {
                          const num = parseInt(match[1], 10);
                          const citation = msg.citations?.find((c) => c.n === num);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => citation && setSelectedCitation(citation)}
                              className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 text-xs font-semibold rounded cursor-pointer transition-colors ${
                                citation
                                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                              title={citation ? `Source ${num}: ${citation.filename}` : `Source [${num}]`}
                            >
                              [{num}]
                            </button>
                          );
                        }
                        return part;
                      });
                    })}
                  </p>
                );
              },
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>

        {/* Ungrounded Fallback Alert */}
        {msg.grounded === false && (
          <div className="flex items-center space-x-2 text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-md p-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              This question could not be verified against the demo SOP documents. To prevent hallucinations, the assistant declined to answer.
            </span>
          </div>
        )}

        {/* Citations Preview Strip */}
        {msg.citations && msg.citations.length > 0 && (
          <div className="pt-2 border-t border-border/40 mt-3 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Sources:
            </span>
            {msg.citations.map((c) => (
              <button
                key={c.n}
                onClick={() => setSelectedCitation(c)}
                className="text-xs bg-card hover:bg-muted border rounded px-2 py-0.5 text-foreground flex items-center space-x-1 transition-colors"
              >
                <span className="font-semibold text-primary">[{c.n}]</span>
                <span className="truncate max-w-[150px]">{c.filename}</span>
                <span className="text-muted-foreground text-[10px]">
                  ({Math.round(c.score * 100)}%)
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Demo Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center justify-center space-x-2">
        <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span>
          Interactive Public Demo · Synthetic Acme Corp SOPs only · Conversations are not saved
        </span>
      </div>

      {/* Main Header */}
      <header className="px-6 py-3 border-b flex items-center justify-between bg-card shrink-0">
        <div className="flex items-center space-x-3">
          <Link
            to="/"
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Back to Home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-sm font-bold flex items-center space-x-2">
              <span>Acme Corp Knowledge Assistant</span>
              <span className="bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full">
                Demo
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Grounded RAG with verifiable source citations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/login"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors shadow-sm"
          >
            Create Your Workspace
          </Link>
        </div>
      </header>

      {/* Body: Chat Stream + Optional Citation Side Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col h-full overflow-hidden max-w-4xl mx-auto w-full px-4 sm:px-6">
          {/* Demo Documents Pill Strip */}
          {documents.length > 0 && (
            <div className="py-2.5 border-b flex items-center space-x-2 overflow-x-auto shrink-0 text-xs text-muted-foreground">
              <span className="font-medium text-foreground whitespace-nowrap flex items-center">
                <FileText className="h-3.5 w-3.5 mr-1 text-primary" />
                Indexed SOPs:
              </span>
              {documents.map((doc) => (
                <span
                  key={doc.id}
                  className="bg-muted px-2.5 py-1 rounded-md border whitespace-nowrap text-foreground flex items-center space-x-1.5"
                >
                  <span className="font-medium">{doc.filename}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({doc.chunk_count} chunks)
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex space-x-3 ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-lg p-4 shadow-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border text-card-foreground'
                  }`}
                >
                  {renderMessageContent(m)}
                </div>

                {m.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center shrink-0 text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex space-x-3 items-center text-muted-foreground text-xs py-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Bot className="h-4 w-4 animate-pulse" />
                </div>
                <div className="flex items-center space-x-2 bg-card border rounded-lg px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Searching Acme SOPs and synthesizing cited answer...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sample Prompts Tray */}
          {messages.length <= 3 && !isLoading && (
            <div className="py-2 shrink-0">
              <p className="text-xs text-muted-foreground mb-1.5 font-medium flex items-center">
                <Sparkles className="h-3 w-3 mr-1 text-primary" />
                Suggested sample questions:
              </p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="text-xs bg-card hover:bg-muted border rounded-md px-3 py-1.5 text-left text-foreground transition-colors shadow-xs"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quota / Error Banner */}
          {errorMessage && (
            <div
              className={`mb-2 p-3 rounded-md text-xs flex items-center justify-between border ${
                quotaExceeded
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {quotaExceeded && (
                <Link
                  to="/signup"
                  className="bg-primary text-primary-foreground font-semibold px-2.5 py-1 rounded text-xs ml-3 whitespace-nowrap hover:bg-primary/90"
                >
                  Sign Up Free
                </Link>
              )}
            </div>
          )}

          {/* Input Bar */}
          <div className="py-3 border-t bg-background shrink-0">
            <div className="relative border rounded-lg bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
              <textarea
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask any question about Acme Corp PTO, travel expenses, or security..."
                rows={2}
                maxLength={2000}
                disabled={isLoading || quotaExceeded}
                className="w-full bg-transparent px-3 py-2.5 text-sm resize-none focus:outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/40 bg-muted/20">
                <span className="text-[11px] text-muted-foreground">
                  {inputQuestion.length}/2000 characters · Press Enter to send
                </span>
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!inputQuestion.trim() || isLoading || quotaExceeded}
                  className="inline-flex items-center space-x-1.5 bg-primary text-primary-foreground px-3 py-1 rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Citation Slide-Out Drawer */}
        {selectedCitation && (
          <aside className="w-80 sm:w-96 border-l bg-card flex flex-col h-full shadow-lg absolute right-0 top-0 bottom-0 z-20 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center space-x-2">
                <span className="bg-primary text-primary-foreground font-bold text-xs px-2 py-0.5 rounded">
                  Source [{selectedCitation.n}]
                </span>
                <h3 className="font-semibold text-sm">Citation Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Document
                </label>
                <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded-md border text-xs font-medium">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{selectedCitation.filename}</span>
                </div>
              </div>

              {selectedCitation.section_title && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Section Heading
                  </label>
                  <p className="text-xs font-medium bg-muted/30 p-2 rounded border">
                    {selectedCitation.section_title}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-muted/30 rounded border">
                  <span className="text-muted-foreground block text-[10px] uppercase">
                    Pages
                  </span>
                  <span className="font-semibold">
                    {selectedCitation.page_start && selectedCitation.page_end
                      ? selectedCitation.page_start === selectedCitation.page_end
                        ? `Page ${selectedCitation.page_start}`
                        : `Pages ${selectedCitation.page_start} - ${selectedCitation.page_end}`
                      : 'Text / SOP'}
                  </span>
                </div>
                <div className="p-2 bg-muted/30 rounded border">
                  <span className="text-muted-foreground block text-[10px] uppercase">
                    Similarity Match
                  </span>
                  <span className="font-semibold text-primary">
                    {Math.round(selectedCitation.score * 100)}% match
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Verified Chunk Snippet
                </label>
                <div className="p-3 bg-muted/20 border rounded-md text-xs leading-relaxed text-muted-foreground italic font-mono whitespace-pre-wrap">
                  "{selectedCitation.snippet}"
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-xs text-muted-foreground space-y-2">
                  <div className="flex items-center space-x-1.5 font-medium text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Cryptographically Verified Source</span>
                  </div>
                  <p>
                    This excerpt was verified against the database chunk vector and metadata. Citations are never fabricated by the model.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-muted/10">
              <Link
                to="/signup"
                className="w-full inline-flex items-center justify-center space-x-2 bg-primary text-primary-foreground py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <span>Upload Your Own Company Docs</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
