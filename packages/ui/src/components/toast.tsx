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
import { Icon } from './icon.js';
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
  info: 'border-border-blue/30',
  success: 'border-border-success/40',
  warning: 'border-border-warning/40',
  danger: 'border-border-error/40',
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
      {/*
        Under the navbar, centred: a toast must never cover a primary action,
        and primary actions sit at the bottom right of a form. Page headings do
        not mind being covered for a few seconds.
      */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed left-1/2 top-[calc(var(--ids-navbar-height)+12px)] z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto animate-fade-in rounded-lg border bg-bg-surface p-4 shadow-3',
              TONE[toast.tone ?? 'info'],
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
                {toast.body !== undefined && (
                  <p className="mt-0.5 text-sm text-text-secondary">{toast.body}</p>
                )}
              </div>
              <IconButton
                label="Dismiss"
                size="sm"
                onClick={() => dismiss(toast.id)}
                icon={
                  <Icon name="close" size={14} />
                }
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
