import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_CATEGORIES,
  categoryCounts,
  findCategory,
  findLesson,
  firstLesson,
  lessonContents,
} from '../src/data/tutorials.js';

/**
 * The tutorial content, checked for the things a reader would notice.
 *
 * No database here: this is editorial content in a typed module, so what can go
 * wrong is structural — a duplicate address, a card claiming topics it does not
 * have, a category that says it is readable and then opens onto nothing.
 */
describe('tutorial content', () => {
  it('gives every category and lesson an address of its own', () => {
    const categoryIds = TUTORIAL_CATEGORIES.map((category) => category.id);
    expect(new Set(categoryIds).size).toBe(categoryIds.length);

    for (const category of TUTORIAL_CATEGORIES) {
      const lessonIds = category.chapters.flatMap((chapter) =>
        chapter.lessons.map((lesson) => lesson.id),
      );
      expect(new Set(lessonIds).size).toBe(lessonIds.length);
    }
  });

  it('counts what the card promises', () => {
    const code = findCategory('code-tech');
    expect(code).toBeDefined();
    if (code === undefined) return;

    const counts = categoryCounts(code);
    const lessons = code.chapters.flatMap((chapter) => chapter.lessons);
    expect(counts.topics).toBe(lessons.length);
    expect(counts.videos).toBe(
      lessons.reduce(
        (total, lesson) => total + lesson.blocks.filter((block) => block.kind === 'video').length,
        0,
      ),
    );
    // The card says "N topics"; a category with none is not offered as a link,
    // so a written one must count above zero or the index lies.
    expect(counts.topics).toBeGreaterThan(0);
  });

  it('opens a category on a lesson that exists', () => {
    for (const category of TUTORIAL_CATEGORIES) {
      const first = firstLesson(category);
      if (category.chapters.length === 0) {
        expect(first).toBeUndefined();
        continue;
      }
      expect(first).toBeDefined();
      if (first === undefined) continue;
      expect(findLesson(category, first.id)).toBeDefined();
    }
  });

  it('does not find a lesson that was never written', () => {
    const code = findCategory('code-tech');
    expect(code).toBeDefined();
    if (code === undefined) return;
    expect(findLesson(code, 'no-such-lesson')).toBeUndefined();
    expect(findCategory('no-such-category')).toBeUndefined();
  });

  it('lists a lesson’s headings, which is what the contents column points at', () => {
    const code = findCategory('code-tech');
    const found = code === undefined ? undefined : findLesson(code, 'introduction');
    expect(found).toBeDefined();
    if (found === undefined) return;

    const headings = lessonContents(found.lesson);
    expect(headings).toContain('IDEEZA AI Model');
    expect(headings).toContain('Summary');
    // Only headings: a paragraph in the contents list would be noise.
    expect(headings.every((heading) => heading.length < 60)).toBe(true);
  });

  it('gives every video a caption and a reward, since the card offers both', () => {
    for (const category of TUTORIAL_CATEGORIES) {
      for (const chapter of category.chapters) {
        for (const lesson of chapter.lessons) {
          for (const block of lesson.blocks) {
            if (block.kind !== 'video') continue;
            expect(block.caption).toBeTruthy();
            expect(block.duration).toBeTruthy();
            expect(block.tokenReward).toBeTruthy();
          }
        }
      }
    }
  });
});
