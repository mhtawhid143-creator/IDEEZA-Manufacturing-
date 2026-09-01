import { PageHeader } from '@ideeza/ui';
import { TutorialCard } from '@/components/tutorial/tutorial-card.js';
import { TUTORIAL_CATEGORIES } from '@/data/tutorials.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * Tutorial categories — the Figma index (node 6:126748).
 *
 * Three across at the desktop width the frames use, two on a tablet, one on a
 * phone. The categories that have been written open; the ones that have not say
 * so on their own faces rather than opening onto an empty page.
 */
const TutorialPage = async () => {
  await requireManufacturer('/tutorial');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tutorial categories"
        description="How the IDEEZA platform works, and how it changes the way hardware gets designed. Take a look through the categories."
      />

      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {TUTORIAL_CATEGORIES.map((category) => (
          <li key={category.id}>
            <TutorialCard category={category} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TutorialPage;
