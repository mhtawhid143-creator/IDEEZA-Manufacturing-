import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Icon, Text } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { ChapterTree } from '@/components/tutorial/chapter-tree.js';
import { LessonBody, headingId } from '@/components/tutorial/lesson-body.js';
import { findCategory, findLesson, lessonContents } from '@/data/tutorials.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * One lesson — the Figma reading page (node 6:126927).
 *
 * Three columns at the width the frames use: the chapter tree at 312, the
 * lesson at 512, the page contents at 164. Below `xl` the contents list goes
 * first and the tree follows the lesson, because on a narrow screen a column of
 * navigation above the thing you came to read is a wall.
 */
const LessonPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly categoryId: string; readonly lessonId: string }>;
}) => {
  const { categoryId, lessonId } = await params;
  await requireManufacturer(`/tutorial/${categoryId}/${lessonId}`);

  const category = findCategory(categoryId);
  if (category === undefined) notFound();

  const found = findLesson(category, lessonId);
  if (found === undefined) notFound();

  const { lesson } = found;
  const contents = lessonContents(lesson);

  return (
    <div className="flex flex-col gap-5">
      <Crumbs
        items={[
          { label: 'Tutorial', href: '/tutorial' },
          { label: category.title, href: `/tutorial/${category.id}` },
          { label: lesson.title },
        ]}
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[312px_minmax(0,1fr)_164px]">
        <aside className="order-2 xl:order-1">
          <ChapterTree
            categoryId={category.id}
            chapters={category.chapters}
            currentLessonId={lesson.id}
          />
        </aside>

        <article className="order-1 min-w-0 xl:order-2">
          <h1 className="text-xl font-semibold text-text-primary">{lesson.title}</h1>
          <div className="mt-4">
            <LessonBody blocks={lesson.blocks} />
          </div>
        </article>

        {contents.length > 0 && (
          <aside className="order-3 xl:sticky xl:top-navbar xl:self-start">
            <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Icon name="list" size={20} />
              Page content
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {contents.map((heading) => (
                <li key={heading}>
                  <Link
                    href={`#${headingId(heading)}`}
                    className="block text-sm text-text-tertiary transition-colors hover:text-text-brand"
                  >
                    {heading}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <Text tone="muted" size="xs">
        Written by IDEEZA. Nothing here is specific to your shop.
      </Text>
    </div>
  );
};

export default LessonPage;
