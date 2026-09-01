import { notFound, redirect } from 'next/navigation';
import { findCategory, firstLesson } from '@/data/tutorials.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * A category has no page of its own — it opens on its first lesson.
 *
 * The Figma has no category landing screen, and inventing one would put a step
 * between the card someone just pressed and the thing they pressed it for. The
 * address stays meaningful: `/tutorial/code-tech` is a link worth sharing, and
 * it lands wherever the chapter list begins.
 */
const CategoryPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly categoryId: string }>;
}) => {
  const { categoryId } = await params;
  await requireManufacturer(`/tutorial/${categoryId}`);

  const category = findCategory(categoryId);
  if (category === undefined) notFound();

  const lesson = firstLesson(category);
  if (lesson === undefined) notFound();

  redirect(`/tutorial/${category.id}/${lesson.id}`);
};

export default CategoryPage;
