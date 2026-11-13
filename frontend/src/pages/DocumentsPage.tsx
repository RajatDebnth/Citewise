import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RotateCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { documentsApi } from '../services/api';
import { DocumentStatus, DocumentSummary } from '../types';

export const DocumentsPage: React.FC = () => {
  const { wid } = useParams<{ wid: string }>();

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confidentialityAck, setConfidentialityAck] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Modal State
  const [docToDelete, setDocToDelete] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Retrying State
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!wid) return;
    try {
      const data = await documentsApi.list(wid);
      setDocuments(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch documents.');
    } finally {
      setLoading(false);
    }
  }, [wid]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Auto-poll every 3s while any document is pending or processing (Blueprint Section 9)
  useEffect(() => {
    const hasActiveDocs = documents.some(
      (d) => d.status === 'pending' || d.status === 'processing'
    );
    if (!hasActiveDocs) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setUploadError(null);
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.docx', '.txt'].includes(ext)) {
      setUploadError('Unsupported format. Only .pdf, .docx, and .txt files are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds the 10 MB maximum size limit.');
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wid || !selectedFile) return;

    if (!confidentialityAck) {
      setUploadError('You must acknowledge the confidentiality notice before uploading.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const result = await documentsApi.upload(wid, selectedFile, confidentialityAck);
      // Prepend pending document to state
      const newDoc: DocumentSummary = {
        id: result.id,
        filename: selectedFile.name,
        mime_type: selectedFile.type || 'application/octet-stream',
        size_bytes: selectedFile.size,
        status: result.status,
        chunk_count: 0,
        created_at: new Date().toISOString(),
      };
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedFile(null);
      setConfidentialityAck(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Please check the document and try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: DocumentSummary) => {
    if (!wid) return;
    try {
      const res = await documentsApi.download(wid, doc.id);
      window.open(res.download_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(`Could not generate download link: ${err?.message || 'Error'}`);
    }
  };

  const handleRetry = async (doc: DocumentSummary) => {
    if (!wid) return;
    setRetryingId(doc.id);
    try {
      const updated = await documentsApi.retry(wid, doc.id);
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? updated : d))
      );
    } catch (err: any) {
      alert(`Retry failed: ${err?.message || 'Error'}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async () => {
    if (!wid || !docToDelete) return;
    setDeleting(true);
    try {
      await documentsApi.delete(wid, docToDelete.id);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      setDocToDelete(null);
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || 'Error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderStatusBadge = (status: DocumentStatus, errorMessage?: string | null) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="h-3 w-3" />
            <span>Ready</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            <Clock className="h-3 w-3" />
            <span>Pending</span>
          </span>
        );
      case 'failed':
        return (
          <span
            className="inline-flex items-center space-x-1 text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2.5 py-0.5 rounded-full cursor-help"
            title={errorMessage || 'Processing failed'}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Upload and manage verified reference files (.pdf, .docx, .txt). Maximum 10 MB per file.
        </p>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchDocuments} className="text-xs font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* Upload Zone Card */}
      <div className="p-6 border rounded-xl bg-card shadow-sm space-y-4">
        <h2 className="text-sm font-semibold flex items-center space-x-2">
          <UploadCloud className="h-4 w-4 text-primary" />
          <span>Add New Document</span>
        </h2>

        <form onSubmit={handleUpload} className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted hover:border-primary/50 bg-background/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelected(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              {selectedFile ? (
                <div className="text-sm">
                  <span className="font-semibold text-foreground">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">({formatSize(selectedFile.size)})</span>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">Click or drag a file to upload</p>
                  <p className="text-xs text-muted-foreground">Supported: PDF (up to 150 pages), Word (.docx), or UTF-8 Text (.txt)</p>
                </>
              )}
            </div>
          </div>

          {/* Confidentiality Checkbox */}
          <div className="flex items-start space-x-3 p-3 bg-muted/40 rounded-lg border text-xs">
            <input
              type="checkbox"
              id="confidentiality-ack"
              checked={confidentialityAck}
              onChange={(e) => setConfidentialityAck(e.target.checked)}
              className="mt-0.5 rounded border-muted text-primary focus:ring-primary/40 cursor-pointer"
            />
            <label htmlFor="confidentiality-ack" className="text-muted-foreground cursor-pointer select-none leading-relaxed">
              <strong className="text-foreground">Confidentiality Acknowledgment:</strong> I confirm that this document contains no trade secrets or unapproved sensitive personal data, and agree to automated parsing and embedding.
            </label>
          </div>

          {uploadError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!selectedFile || !confidentialityAck || uploading}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
            >
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{uploading ? 'Validating & Uploading…' : 'Upload Document'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Documents List Table */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center space-x-2">
          <FileText className="h-4 w-4 text-primary" />
          <span>Uploaded Documents ({documents.length})</span>
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl border bg-card animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-card/40 border-dashed p-6 text-xs text-muted-foreground">
            No documents in this workspace yet. Upload your first document above.
          </div>
        ) : (
          <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="divide-y">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition text-xs"
                >
                  <div className="flex items-start space-x-3 min-w-0">
                    <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate" title={doc.filename}>
                        {doc.filename}
                      </p>
                      <div className="flex items-center space-x-3 text-muted-foreground text-[11px] mt-0.5">
                        <span>{formatSize(doc.size_bytes)}</span>
                        {doc.page_count && <span>• {doc.page_count} page{doc.page_count === 1 ? '' : 's'}</span>}
                        {doc.chunk_count > 0 && <span>• {doc.chunk_count} chunk{doc.chunk_count === 1 ? '' : 's'}</span>}
                        <span>• Uploaded {new Date(doc.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                      </div>
                      {doc.error_message && (
                        <p className="text-destructive text-[11px] mt-1 font-medium">
                          Error: {doc.error_message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    {renderStatusBadge(doc.status, doc.error_message)}

                    {doc.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(doc)}
                        disabled={retryingId === doc.id}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs rounded border hover:bg-muted transition text-muted-foreground hover:text-foreground"
                        title="Retry processing"
                      >
                        {retryingId === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        <span>Retry</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
                      title="Download document"
                    >
                      <ArrowDownToLine className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setDocToDelete(doc)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border rounded-xl shadow-lg p-6 relative">
            <h2 className="text-lg font-bold text-destructive mb-2">Delete Document?</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              Are you sure you want to delete <strong className="text-foreground">"{docToDelete.filename}"</strong>? The document file, extracted text chunks, and vector embeddings will be removed permanently.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 border rounded-md text-xs font-medium hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-xs font-medium hover:bg-destructive/90 transition flex items-center space-x-2 disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{deleting ? 'Deleting…' : 'Yes, Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
