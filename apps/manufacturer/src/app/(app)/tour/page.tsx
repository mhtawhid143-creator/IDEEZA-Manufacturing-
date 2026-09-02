import { PageHeader } from '@ideeza/ui';
import { TourIndex } from '@/components/tour/tour-index.js';
import { readProgress } from '@/data/tour.js';
import { findTour, TOURS, TOTAL_STOPS } from '@/data/tours.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * The tour guide.
 *
 * The tutorial next door is something to read; this is being shown around. Each
 * tour walks the panel itself, lighting up the control it is talking about, so
 * the page here is only the way in and the record of where somebody got to.
 */
const TourPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireManufacturer('/tour');
  const parameters = await searchParams;
  const progress = await readProgress(actor.userId);

  const finishedParameter = parameters['finished'];
  const finishedJustNow = findTour(
    typeof finishedParameter === 'string' ? finishedParameter : '',
  );
  const finishedCount = TOURS.filter((tour) => progress[tour.id]?.finished === true).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tour guide"
        description={
          <span className="block max-w-measure">
            Five walks through this panel, standing on the real screens and pointing at the control
            each one is about. Stop in the middle, do the thing it is showing you, and pick it up
            again from here.{' '}
            {finishedCount === 0
              ? `${String(TOTAL_STOPS)} stops in all.`
              : `You have finished ${String(finishedCount)} of ${String(TOURS.length)}.`}
          </span>
        }
      />

      <TourIndex
        progress={progress}
        {...(finishedJustNow === undefined ? {} : { finishedJustNow })}
      />
    </div>
  );
};

export default TourPage;
