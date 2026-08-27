import { SkeletonRows } from '@ideeza/ui';

/** Shown while a server component fetches. Same shape as the content it replaces. */
const Loading = () => (
  <div className="flex flex-col gap-6">
    <SkeletonRows rows={2} />
    <SkeletonRows rows={4} />
  </div>
);

export default Loading;
