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
import { Icon, type IconName } from './icon.js';
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

// M02 Toast keeps one neutral raised card for every message; the severity
// lives in the small leading chip, so a stack of mixed toasts still reads as
// one surface. The chip fills are the tokens the Figma variants bind — brand
// for a plain notification, the icon status colours for the rest.
const TONE_CHIP = {
  info: 'bg-bg-brand',
  success: 'bg-icon-success',
  warning: 'bg-icon-warning',
  danger: 'bg-icon-error',
} as const;

const TONE_GLYPH: Record<keyof typeof TONE_CHIP, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  danger: 'close',
};

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
        className="pointer-events-none fixed left-1/2 top-[calc(var(--layout-navbar-height)+12px)] z-toast flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-fade-in rounded-xl border border-border-subtle bg-bg-surface-raised py-3.5 pl-4 pr-3.5 shadow-2"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-icon-on-brand',
                  TONE_CHIP[toast.tone ?? 'info'],
                )}
              >
                <Icon name={TONE_GLYPH[toast.tone ?? 'info']} size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-text-primary">{toast.title}</p>
                {toast.body !== undefined && (
                  <p className="mt-1 text-sm text-text-secondary">{toast.body}</p>
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
