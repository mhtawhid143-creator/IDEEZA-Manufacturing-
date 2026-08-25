import { headers } from 'next/headers';
import { AppShell } from '@/components/shell/app-shell.js';
import { requireBuyer } from '@/lib/auth.js';

/** Every page in this group is behind the buyer guard. */
export const dynamic = 'force-dynamic';

const AppLayout = async ({ children }: { readonly children: React.ReactNode }) => {
  // The middleware forwards the resolved path, so the guard checks the route the
  // visitor actually asked for rather than the layout segment. Each page also
  // authorises its own concrete path, which is the authoritative check.
  const headerBag = await headers();
  const path = headerBag.get('x-ideeza-path') ?? '/manufacturing';

  const actor = await requireBuyer(path);

  return (
    <AppShell displayName={actor.email.split('@')[0] ?? 'Buyer'} email={actor.email}>
      {children}
    </AppShell>
  );
};

export default AppLayout;
