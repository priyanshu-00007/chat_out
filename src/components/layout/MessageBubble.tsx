import { Check, CheckCheck, Clock, Download, FileText } from 'lucide-react';
import type { Message, MessageStatus } from '@/types';
import { formatFileSize, formatMessageTime } from '@/utils/formatters';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  senderName?: string;
  showSenderName?: boolean;
}

function StatusIcon({ status }: { status: MessageStatus }) {
  if (status === 'sending') {
    return <Clock className="h-3.5 w-3.5 text-indigo-200/80" aria-label="Sending" />;
  }
  if (status === 'sent') {
    return <Check className="h-3.5 w-3.5 text-indigo-200/90" aria-label="Sent" />;
  }
  return <CheckCheck className="h-3.5 w-3.5 text-emerald-300" aria-label="Read" />;
}

export function MessageBubble({
  message,
  isOwn,
  senderName,
  showSenderName = false,
}: MessageBubbleProps) {
  if (message.isSystem) {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-2xs sm:max-w-[70%] ${
          isOwn
            ? 'rounded-br-md bg-indigo-600 text-white'
            : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
        }`}
      >
        {showSenderName && !isOwn && senderName && (
          <p className="mb-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            {senderName}
          </p>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-1.5 space-y-1.5">
            {message.attachments.map((att) =>
              att.type === 'image' && att.url ? (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-black/10 dark:border-white/10"
                >
                  <img
                    src={att.url}
                    alt={att.name}
                    className="max-h-64 w-full object-cover"
                  />
                </a>
              ) : (
                <a
                  key={att.id}
                  href={att.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={att.name}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 transition ${
                    isOwn
                      ? 'bg-indigo-700/70 text-white hover:bg-indigo-700'
                      : 'border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isOwn
                        ? 'bg-indigo-500/40'
                        : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{att.name}</p>
                    <p
                      className={`text-[10px] ${
                        isOwn ? 'text-indigo-100/80' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {formatFileSize(att.size)}
                    </p>
                  </div>
                  <Download className="h-3.5 w-3.5 shrink-0 opacity-75" />
                </a>
              )
            )}
          </div>
        )}

        {message.content && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.content}
          </p>
        )}

        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            isOwn ? 'text-indigo-100/90' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <span>{formatMessageTime(message.timestamp)}</span>
          {isOwn && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}
