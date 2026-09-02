'use server';

import { removeArticle, saveArticle, type ArticleEdit } from '@/data/articles.js';
import { requireManufacturer } from '@/lib/auth.js';

export interface ArticleState {
  readonly saved: boolean;
  readonly error?: string | undefined;
}

/** Saves a draft, or sends one to IDEEZA. Both are the shop's own writing. */
export const saveArticleAction = async (edit: ArticleEdit): Promise<ArticleState> => {
  const actor = await requireManufacturer('/blog');
  const result = await saveArticle(actor.manufacturerId, edit);
  return result.ok ? { saved: true } : { saved: false, error: result.message };
};

/** Deletes one. */
export const removeArticleAction = async (articleId: string): Promise<ArticleState> => {
  const actor = await requireManufacturer('/blog');
  const result = await removeArticle(actor.manufacturerId, articleId);
  return result.ok ? { saved: true } : { saved: false, error: result.message };
};
