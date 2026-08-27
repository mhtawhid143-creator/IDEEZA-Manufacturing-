import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell.js';
import { getShopContext } from '@/data/shop.js';
import { requireManufacturer } from '@/lib/auth.js';

/** Every page in this group is behind the manufacturer guard. */
export const dynamic = 'force-dynamic';

const AppLayout = async ({ children }: { readonly children: React.ReactNode }) => {
  // The middleware forwards the resolved path, so the guard checks the route the
  // visitor actually asked for rather than the layout segment. Each page also
  // authorises its own concrete path, which is the authoritative check.
  const headerBag = await headers();
  const path = headerBag.get('x-ideeza-path') ?? '/dashboard';

  const actor = await requireManufacturer(path);
  const shop = await getShopContext(actor.manufacturerId, actor.userId);
  if (shop === null) redirect('/forbidden');

  return (
    <AppShell
      displayName={actor.email.split('@')[0] ?? 'Member'}
      email={actor.email}
      companyName={shop.displayName}
      notificationCount={shop.unreadNotifications}
      profileCompleteness={shop.profileCompleteness}
    >
      {children}
    </AppShell>
  );
};

export default AppLayout;
