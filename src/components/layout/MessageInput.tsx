import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { FileText, Image as ImageIcon, Paperclip, Send, Smile, X } from 'lucide-react';
import { QUICK_EMOJIS } from '@/data/emojis';
import { validateAttachmentFile } from '@/services/storageService';
import { formatFileSize } from '@/utils/formatters';

interface PendingFileItem {
  id: string;
  file: File;
  previewUrl?: string;
}

interface MessageInputProps {
  onSend: (content: string, files: File[]) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
}

export function MessageInput({ onSend, onTyping }: MessageInputProps) {
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFileItem[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const emojiPopoverRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      pendingFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        emojiPopoverRef.current &&
        !emojiPopoverRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showEmojiPicker]);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const notifyTyping = () => {
    if (!onTyping) return;
    onTyping(true);
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      onTyping(false);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const stopTypingImmediately = () => {
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    onTyping?.(false);
  };

  const handleSend = async () => {
    if (isSending) return;
    const trimmed = text.trim();
    if (!trimmed && pendingFiles.length === 0) return;

    setIsSending(true);
    setError(null);
    stopTypingImmediately();

    try {
      await onSend(
        trimmed,
        pendingFiles.map((item) => item.file)
      );
      pendingFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setText('');
      setPendingFiles([]);
      setShowEmojiPicker(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const nextItems: PendingFileItem[] = [];
    for (const file of files) {
      const validationErr = validateAttachmentFile(file);
      if (validationErr) {
        setError(validationErr);
        e.target.value = '';
        return;
      }
      const isImage = file.type.startsWith('image/');
      nextItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      });
    }

    setError(null);
    setPendingFiles((prev) => [...prev, ...nextItems]);
    e.target.value = '';
  };

  const handleEmojiInsert = (emoji: string) => {
    setText((prev) => `${prev}${emoji}`);
    textareaRef.current?.focus();
    notifyTyping();
  };

  const removeAttachment = (id: string) => {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const canSend = (text.trim().length > 0 || pendingFiles.length > 0) && !isSending;

  return (
    <div className="border-t border-slate-200 bg-white px-3 py-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
      {error && (
        <div
          role="alert"
          className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="rounded p-0.5 hover:bg-rose-100 dark:hover:bg-rose-900/50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Pending attachment previews */}
      {pendingFiles.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {pendingFiles.map((item) => (
            <div
              key={item.id}
              className="group relative flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pr-7 dark:border-slate-700 dark:bg-slate-800"
            >
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <FileText className="h-4 w-4" />
                </div>
              )}
              <div className="max-w-36">
                <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                  {item.file.name}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {formatFileSize(item.file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(item.id)}
                aria-label={`Remove ${item.file.name}`}
                className="absolute top-1 right-1 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-2">
        {/* Emoji picker trigger */}
        <div ref={emojiPopoverRef} className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            aria-label="Insert emoji"
            title="Emoji"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <Smile className="h-5 w-5" />
          </button>

          {showEmojiPicker && (
            <div className="absolute bottom-12 left-0 z-30 grid w-56 grid-cols-6 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiInsert(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* File attachment button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
          title="Attach file"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        {/* Image upload button */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          aria-label="Upload image"
          title="Upload image"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <ImageIcon className="h-5 w-5" />
        </button>

        {/* Message textarea */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              adjustHeight();
              if (e.target.value.trim()) {
                notifyTyping();
              } else {
                stopTypingImmediately();
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={isSending ? 'Sending...' : 'Write a message...'}
            aria-label="Message input"
            className="max-h-32 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-800"
          />
        </div>

        {/* Send button */}
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void handleSend()}
          aria-label="Send message"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
