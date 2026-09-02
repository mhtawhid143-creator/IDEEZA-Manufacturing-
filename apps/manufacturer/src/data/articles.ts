import type { ManufacturerId } from '@ideeza/domain';
import { database } from '@/lib/db.js';

/**
 * What a shop writes for buyers to read on its profile.
 *
 * The screen that writes these and the profile tab that shows them are two
 * views of one table. They used to disagree — the screen kept articles in React
 * state and said so, while the tab read `ShopArticle` and therefore showed
 * nothing a shop had written. Everything here is scoped by shop on the first
 * query, the same as every other write in this app.
 *
 * IDEEZA reads an article before it appears on a profile, so publishing is not
 * the shop's to do: `draft` is the shop's own, `in_review` is with IDEEZA, and
 * `published` and `rejected` are IDEEZA's answers. `MANUFACTURER-SIDE-PLAN.md`
 * §13 records why.
 */
export type ArticleState = 'draft' | 'in_review' | 'published' | 'rejected';

export interface ArticleRow {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly body: string;
  readonly status: ArticleState;
  readonly on: string;
  readonly rejectReason: string | null;
  readonly readMinutes: number;
}

export interface ArticleOutcome {
  readonly ok: boolean;
  readonly message?: string;
}

/** Roughly what it takes to read, at the usual two hundred words a minute. */
export const readMinutes = (body: string): number =>
  Math.max(1, Math.round(body.trim().split(/\s+/).filter(Boolean).length / 200));

const day = (value: Date): string => value.toISOString().slice(0, 10);

const asRow = (article: {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  body: string;
  status: string;
  rejectReason: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}): ArticleRow => ({
  id: article.id,
  title: article.title,
  category: article.category ?? 'Manufacturing',
  tags: article.tags,
  body: article.body,
  status: article.status as ArticleState,
  on: day(article.publishedAt ?? article.updatedAt),
  rejectReason: article.rejectReason,
  readMinutes: readMinutes(article.body),
});

export const listArticles = async (
  manufacturerId: ManufacturerId,
): Promise<readonly ArticleRow[]> => {
  const rows = await database().shopArticle.findMany({
    where: { manufacturerId },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(asRow);
};

export interface ArticleEdit {
  /** Absent for a new one; present to rewrite one this shop already has. */
  readonly id?: string;
  readonly title: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly body: string;
  /** Only these two: a shop cannot publish itself, and cannot reject itself. */
  readonly status: 'draft' | 'in_review';
}

/**
 * Writes one, new or existing.
 *
 * The minimum is a title and a few sentences, refused here rather than left for
 * IDEEZA to bounce — a shop hearing no a day later for something the form could
 * have said immediately is a day wasted on both sides.
 */
export const saveArticle = async (
  manufacturerId: ManufacturerId,
  edit: ArticleEdit,
): Promise<ArticleOutcome> => {
  const title = edit.title.trim();
  const body = edit.body.trim();
  if (title.length < 3) return { ok: false, message: 'An article needs a title.' };
  if (body.length < 50) {
    return { ok: false, message: 'A few sentences at least — this is what a buyer judges you on.' };
  }

  const tags = [
    ...new Set(edit.tags.map((tag) => tag.trim()).filter((tag) => tag !== '')),
  ].slice(0, 6);

  const fields = {
    title,
    category: edit.category.trim() === '' ? null : edit.category.trim(),
    tags,
    body,
    status: edit.status,
    // Sending a rewritten article back to IDEEZA clears the old reason: it was
    // an answer about the version before this one.
    rejectReason: null,
  };

  if (edit.id === undefined) {
    await database().shopArticle.create({
      data: {
        id: `article_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        manufacturerId,
        ...fields,
      },
    });
    return { ok: true };
  }

  const { count } = await database().shopArticle.updateMany({
    where: { id: edit.id, manufacturerId },
    data: fields,
  });
  return count === 0
    ? { ok: false, message: 'That article is not one of yours.' }
    : { ok: true };
};

/** Takes one down, scoped so a member can only remove their own shop's. */
export const removeArticle = async (
  manufacturerId: ManufacturerId,
  articleId: string,
): Promise<ArticleOutcome> => {
  const { count } = await database().shopArticle.deleteMany({
    where: { id: articleId, manufacturerId },
  });
  return count === 0
    ? { ok: false, message: 'That article is not one of yours.' }
    : { ok: true };
};
