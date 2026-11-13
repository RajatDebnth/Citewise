import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  AlertCircle,
  Bot,
  ExternalLink,
  FileText,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  X,
} from 'lucide-react';

import { ApiException, chatApi } from '../services/api';
import { ChatMessage, CitationItem, ConversationSummary } from '../types';

export const ChatPage: React.FC = () => {
  const { wid, cid } = useParams<{ wid: string; cid?: string }>();
  const navigate = useNavigate();

  // Conversations state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Active chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Citation panel state
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);

  // Feedback tracking per message id: 1 | -1
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 1 | -1>>({});

  // Modals & Menu
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Load conversation list
  const loadConversations = async () => {
    if (!wid) return;
    try {
      setLoadingConversations(true);
      const data = await chatApi.listConversations(wid);
      setConversations(data || []);
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [wid]);

  // 2. Load active conversation messages when cid changes
  useEffect(() => {
    if (!wid) return;
    if (!cid) {
      setMessages([]);
      setSelectedCitation(null);
      return;
    }

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        setErrorBanner(null);
        setSelectedCitation(null);
        const data = await chatApi.getConversation(wid, cid);
        setMessages(data.messages || []);
      } catch (err: any) {
        if (err instanceof ApiException && err.status === 404) {
          navigate(`/app/w/${wid}/chat`, { replace: true });
        } else {
          setErrorBanner(err.message || 'Failed to load conversation messages');
        }
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [wid, cid]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Handle Send question
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!wid || !inputQuestion.trim() || isSending) return;

    const questionText = inputQuestion.trim();
    setInputQuestion('');
    setErrorBanner(null);

    // Optimistically append user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: questionText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      const resp = await chatApi.sendMessage(wid, {
        conversation_id: cid,
        question: questionText,
      });

      // Append assistant message
      const asstMsg: ChatMessage = {
        id: resp.message_id,
        role: 'assistant',
        content: resp.answer,
        grounded: resp.grounded,
        citations: resp.citations,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, asstMsg]);

      // If this was a new conversation, update route and refresh list
      if (!cid && resp.conversation_id) {
        await loadConversations();
        navigate(`/app/w/${wid}/chat/${resp.conversation_id}`, { replace: true });
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      // Revert optimistic user message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setInputQuestion(questionText);

      if (err instanceof ApiException) {
        if (err.status === 429) {
          setErrorBanner('Daily question quota exceeded. Please try again tomorrow.');
        } else if (err.status === 503) {
          setErrorBanner('Chat functionality is currently disabled by administrator.');
        } else {
          setErrorBanner(err.message || 'Failed to get answer. Please try again.');
        }
      } else {
        setErrorBanner(err.message || 'An error occurred while answering your question.');
      }
    } finally {
      setIsSending(false);
    }
  };

  // Handle feedback
  const handleFeedback = async (messageId: string, rating: 1 | -1) => {
    try {
      setMessageFeedback((prev) => ({ ...prev, [messageId]: rating }));
      await chatApi.sendFeedback(messageId, { rating });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  // Handle Rename
  const handleRename = async () => {
    if (!wid || !editingConvId || !newTitle.trim()) return;
    try {
      await chatApi.renameConversation(wid, editingConvId, newTitle.trim());
      setConversations((prev) =>
        prev.map((c) => (c.id === editingConvId ? { ...c, title: newTitle.trim() } : c))
      );
      setEditingConvId(null);
      setNewTitle('');
    } catch (err: any) {
      alert(err.message || 'Failed to rename conversation');
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!wid || !deletingConvId) return;
    try {
      await chatApi.deleteConversation(wid, deletingConvId);
      setConversations((prev) => prev.filter((c) => c.id !== deletingConvId));
      if (cid === deletingConvId) {
        navigate(`/app/w/${wid}/chat`);
      }
      setDeletingConvId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete conversation');
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Sidebar: Conversations list */}
      <div className="w-64 md:w-72 border-r border-border bg-card/60 flex flex-col shrink-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Conversations</h2>
          <button
            onClick={() => {
              navigate(`/app/w/${wid}/chat`);
              setMessages([]);
              setSelectedCitation(null);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConversations ? (
            <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No conversations yet. Start asking questions!
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === cid;
              return (
                <div
                  key={conv.id}
                  className={`group relative flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-accent text-foreground'
                  }`}
                  onClick={() => navigate(`/app/w/${wid}/chat/${conv.id}`)}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate" title={conv.title}>
                      {conv.title}
                    </span>
                  </div>

                  {/* Actions dropdown trigger */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === conv.id ? null : conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background/80 transition-opacity"
                    >
                      <MoreVertical className="w-3 h-3 text-muted-foreground" />
                    </button>

                    {activeMenuId === conv.id && (
                      <div
                        className="absolute right-0 top-6 w-28 bg-popover text-popover-foreground rounded-md shadow-md border border-border py-1 z-20 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingConvId(conv.id);
                            setNewTitle(conv.title);
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent text-left"
                        >
                          <Pencil className="w-3 h-3" />
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            setDeletingConvId(conv.id);
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent text-destructive text-left"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Error banner */}
        {errorBanner && (
          <div className="bg-destructive/10 text-destructive text-xs px-4 py-2 border-b border-destructive/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner(null)} className="p-1 hover:bg-destructive/20 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Loading conversation history...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3 shadow-inner">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-1">Company Knowledge Assistant</h3>
              <p className="text-xs max-w-sm mb-6">
                Ask questions about your uploaded documents, policies, or procedures. Every answer is strictly grounded with citations.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-md w-full">
                {[
                  'What is our annual leave policy?',
                  'How do expense report reimbursements work?',
                  'Summarize the core security guidelines.',
                  'What are the engineering on-call rotation rules?',
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setInputQuestion(preset);
                    }}
                    className="p-3 text-left rounded-lg border border-border bg-card/60 hover:bg-accent/80 transition-colors text-xs text-foreground"
                  >
                    "{preset}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 text-sm leading-relaxed ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-card border border-border rounded-tl-none'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        {/* Ungrounded / Not-found banner */}
                        {msg.grounded === false && (
                          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>
                              Not found in your uploaded documents. Logged to the{' '}
                              <a
                                href={`/app/w/${wid}/unanswered`}
                                className="underline font-semibold hover:opacity-80"
                              >
                                unanswered questions list
                              </a>
                              .
                            </span>
                          </div>
                        )}

                        {/* Safe Markdown rendering */}
                        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground break-words">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>

                        {/* Citation Chips */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                              Sources:
                            </span>
                            {msg.citations.map((c) => {
                              const isSelected = selectedCitation?.chunk_id === c.chunk_id;
                              return (
                                <button
                                  key={c.n}
                                  onClick={() => setSelectedCitation(isSelected ? null : c)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                    isSelected
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                                  }`}
                                  title={`Source [${c.n}]: ${c.filename} (${c.section_title || 'General'})`}
                                >
                                  <span className="font-bold">[{c.n}]</span>
                                  <span className="truncate max-w-[130px]">{c.filename}</span>
                                  {c.page_start && (
                                    <span className="text-[10px] opacity-75">
                                      p.{c.page_start}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Assistant Footer: Feedback buttons */}
                        <div className="mt-3 pt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="text-[11px] opacity-70">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleFeedback(msg.id, 1)}
                              className={`p-1.5 rounded hover:bg-accent transition-colors ${
                                messageFeedback[msg.id] === 1 ? 'text-emerald-500 font-bold' : ''
                              }`}
                              title="Helpful response"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleFeedback(msg.id, -1)}
                              className={`p-1.5 rounded hover:bg-accent transition-colors ${
                                messageFeedback[msg.id] === -1 ? 'text-destructive font-bold' : ''
                              }`}
                              title="Unhelpful response"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isSending && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                <span className="text-xs text-muted-foreground ml-1">Searching documents & generating answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border bg-card/40">
          <form onSubmit={handleSend} className="relative flex items-center">
            <textarea
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question about your documents... (Shift+Enter for newline)"
              rows={2}
              maxLength={2000}
              disabled={isSending}
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-2.5 pr-14 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSending || !inputQuestion.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-sm"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 px-1">
            <span>Powered by Gemini • Strictly cited from internal documents</span>
            <span>{inputQuestion.length}/2000</span>
          </div>
        </div>
      </div>

      {/* Right Drawer: Citation Side Panel */}
      {selectedCitation && (
        <div className="w-80 md:w-96 border-l border-border bg-card p-5 flex flex-col h-full shadow-lg transition-all animate-in slide-in-from-right duration-200 shrink-0">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary text-primary-foreground font-bold text-xs">
                [{selectedCitation.n}]
              </span>
              <h3 className="font-semibold text-sm truncate max-w-[200px]" title={selectedCitation.filename}>
                {selectedCitation.filename}
              </h3>
            </div>
            <button
              onClick={() => setSelectedCitation(null)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Metadata badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 p-2.5 rounded-lg border border-border/50">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Location
                </span>
                <span className="font-medium text-foreground">
                  {selectedCitation.page_start
                    ? `Page ${selectedCitation.page_start}${
                        selectedCitation.page_end && selectedCitation.page_end !== selectedCitation.page_start
                          ? `-${selectedCitation.page_end}`
                          : ''
                      }`
                    : 'Page 1'}
                </span>
              </div>
              <div className="bg-muted/50 p-2.5 rounded-lg border border-border/50">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Similarity Score
                </span>
                <span className="font-medium text-foreground">
                  {(selectedCitation.score * 100).toFixed(1)}% match
                </span>
              </div>
            </div>

            {selectedCitation.section_title && (
              <div className="bg-muted/50 p-2.5 rounded-lg border border-border/50 text-xs">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Section
                </span>
                <span className="font-medium text-foreground">
                  {selectedCitation.section_title}
                </span>
              </div>
            )}

            {/* Snippet box */}
            <div>
              <span className="text-muted-foreground text-xs font-semibold uppercase block mb-1.5">
                Source Excerpt
              </span>
              <div className="p-3.5 bg-muted/30 border border-border rounded-xl text-xs leading-relaxed text-foreground whitespace-pre-wrap font-mono">
                {selectedCitation.snippet}
              </div>
            </div>

            <div className="pt-2">
              <a
                href={`/app/w/${wid}/documents`}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-border bg-background hover:bg-accent text-xs font-medium text-foreground transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                View in Documents
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {editingConvId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-xl max-w-sm w-full p-5 shadow-xl animate-in fade-in-50 zoom-in-95">
            <h3 className="font-semibold text-base mb-3">Rename Conversation</h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={100}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background mb-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingConvId(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!newTitle.trim()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingConvId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-xl max-w-sm w-full p-5 shadow-xl animate-in fade-in-50 zoom-in-95">
            <h3 className="font-semibold text-base mb-2">Delete Conversation?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              This will permanently delete this conversation and all its message history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingConvId(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
