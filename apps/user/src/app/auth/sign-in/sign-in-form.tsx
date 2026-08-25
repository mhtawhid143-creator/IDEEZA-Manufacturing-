'use client';

import { useActionState } from 'react';
import { Alert, Button, FormField, Input } from '@ideeza/ui';
import { signInAction, type SignInState } from '../actions.js';

export const SignInForm = ({ next }: { readonly next: string }) => {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.error !== undefined && <Alert tone="danger" title={state.error} />}

      <FormField label="Email address" required>
        <Input
          key={state.email ?? 'empty'}
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@company.com"
          defaultValue={state.email ?? ''}
          required
        />
      </FormField>

      <FormField label="Password" required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          required
        />
      </FormField>

      <Button type="submit" size="lg" loading={pending} fullWidth>
        Sign in
      </Button>
    </form>
  );
};
