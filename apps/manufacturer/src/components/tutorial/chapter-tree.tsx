'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon, cn } from '@ideeza/ui';
import type { Chapter } from '@/data/tutorials.js';

export interface ChapterTreeProps {
  readonly categoryId: string;
  readonly chapters: readonly Chapter[];
  readonly currentLessonId: string;
}

/**
 * The left column of a lesson page — the Figma chapter tree at 312px.
 *
 * Each chapter opens and closes; the one holding the lesson being read starts
 * open, because arriving on a page whose place in the book is hidden is the
 * thing this column exists to prevent.
 *
 * The lessons are links rather than buttons: each is a page with an address, so
 * the back button, a bookmark and a middle click all behave. The one being read
 * carries `aria-current`, which is what makes the highlight mean something to a
 * screen reader as well as to the eye.
 */
export const ChapterTree = ({ categoryId, chapters, currentLessonId }: ChapterTreeProps) => {
  const [open, setOpen] = useState<Readonly<Record<string, boolean>>>(() =>
    Object.fromEntries(
      chapters.map((chapter) => [
        chapter.id,
        chapter.lessons.some((lesson) => lesson.id === currentLessonId),
      ]),
    ),
  );

  return (
    <nav aria-label="Chapters" className="flex flex-col gap-1">
      {chapters.map((chapter) => {
        const expanded = open[chapter.id] === true;
        const panelId = `chapter-${chapter.id}`;
        return (
          <div key={chapter.id}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setOpen((current) => ({ ...current, [chapter.id]: !expanded }))}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-text-primary transition-colors hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus"
            >
              <span className="min-w-0 truncate">{chapter.title}</span>
              <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={20} />
            </button>

            {expanded && (
              <ul id={panelId} className="ml-3 flex flex-col gap-0.5 border-l border-border-subtle pl-2">
                {chapter.lessons.map((lesson) => {
                  const here = lesson.id === currentLessonId;
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/tutorial/${categoryId}/${lesson.id}`}
                        aria-current={here ? 'page' : undefined}
                        className={cn(
                          'block truncate rounded-lg px-3 py-1.5 text-sm transition-colors',
                          here
                            ? 'bg-bg-brand-subtle font-medium text-text-brand'
                            : 'text-text-secondary hover:bg-bg-surface-raised hover:text-text-primary',
                        )}
                      >
                        {lesson.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
};
