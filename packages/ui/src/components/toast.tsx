'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';
import { IconButton } from './icon-button.js';
import type { Tone } from './badge.js';

export interface ToastMessage {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly tone?: Extract<Tone, 'info' | 'success' | 'warning' | 'danger'>;
  readonly durationMs?: number;
}

interface ToastContextValue {
  readonly toasts: readonly ToastMessage[];
  readonly push: (message: Omit<ToastMessage, 'id'> & { readonly id?: string }) => string;
  readonly dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const value = useContext(ToastContext);
  if (value === null) throw new Error('useToast must be used inside a ToastProvider.');
  return value;
};

const TONE = {
  info: 'border-info/30',
  success: 'border-success/40',
  warning: 'border-warning/40',
  danger: 'border-danger/40',
} as const;

let counter = 0;

export const ToastProvider = ({ children }: { readonly children: ReactNode }) => {
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: Omit<ToastMessage, 'id'> & { readonly id?: string }): string => {
      counter += 1;
      const id = message.id ?? `toast-${counter}`;
      const toast: ToastMessage = { ...message, id };
      setToasts((current) => [...current, toast]);
      const duration = message.durationMs ?? 6000;
      if (duration > 0 && typeof window !== 'undefined') {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* A live region: a toast is announced without stealing focus. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto animate-slide-up rounded-lg border bg-surface p-4 shadow-dropdown',
              TONE[toast.tone ?? 'info'],
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-heading">{toast.title}</p>
                {toast.body !== undefined && (
                  <p className="mt-0.5 text-sm text-body">{toast.body}</p>
                )}
              </div>
              <IconButton
                label="Dismiss"
                size="sm"
                onClick={() => dismiss(toast.id)}
                icon={
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="m4 4 8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                }
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
