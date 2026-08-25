import type { ReactNode } from 'react';
import { NotBuiltYet, PageHeader, type Crumb } from '@ideeza/ui';
import { Crumbs } from './crumbs.js';
import { requireBuyer } from '@/lib/auth.js';

export interface PlaceholderPageProps {
  /** The concrete path, authorised against the shared route table. */
  readonly path: string;
  readonly title: string;
  readonly description?: string;
  readonly crumbs?: readonly Crumb[];
  readonly plannedIn: string;
  readonly children?: ReactNode;
}

/**
 * A route that exists so the shell and the navigation can be reviewed, with the
 * feature itself openly marked as not built. It still passes the real guard, so
 * the protection is exercised rather than mocked.
 */
export const PlaceholderPage = async ({
  path,
  title,
  description,
  crumbs,
  plannedIn,
  children,
}: PlaceholderPageProps) => {
  await requireBuyer(path);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={
crumbs === undefined ? undefined : <Crumbs items={crumbs} />}
      />
      <NotBuiltYet title={title} plannedIn={plannedIn} />
      {children}
    </div>
  );
};
