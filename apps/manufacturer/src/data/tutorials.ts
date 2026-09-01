/**
 * What the tutorial screens read.
 *
 * This is editorial content, not platform data: nobody in a shop writes it, no
 * status turns on it, and no query needs to be scoped to an actor. So it lives
 * as a typed module rather than a table — the same decision the design system
 * catalogue takes. When there is an authoring surface for it, the shape below
 * is what the rows will hold.
 *
 * The words, the prices and the counts are the Figma frames' own (node
 * 6:126747), with its typos corrected.
 */

export interface LessonBlock {
  readonly kind: 'text' | 'heading' | 'video' | 'figure';
  /** For `heading`, the words. For `text`, the paragraph. */
  readonly text?: string;
  /** For `video` and `figure`, what the still shows — the alt text. */
  readonly caption?: string;
  /** For `video`, how long it runs, as the design writes it. */
  readonly duration?: string;
  /** For `video`, the reward the design offers for watching it. */
  readonly tokenReward?: string;
  /**
   * A hue for the placeholder still, 0–360.
   *
   * There is no media store behind these screens yet. Rather than ship a broken
   * image or a grey box, each still is drawn from its own hue so the page reads
   * as a page — and the caption says what the video is, which is the part that
   * carries the meaning.
   */
  readonly hue?: number;
}

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly LessonBlock[];
}

export interface Chapter {
  readonly id: string;
  readonly title: string;
  readonly lessons: readonly Lesson[];
}

export interface TutorialCategory {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly priceLabel: string;
  readonly hue: number;
  readonly chapters: readonly Chapter[];
}

const INTRO_BLOCKS: readonly LessonBlock[] = [
  {
    kind: 'text',
    text: 'AI driven product development tool from which a normal user can make products without having knowledge or resources. In addition to that they can sell the product to NFT Blockchain with ownership and monetisation.',
  },
  {
    kind: 'video',
    caption: 'A board being assembled, component by component',
    duration: '4 min',
    tokenReward: '2.0 IDZ',
    hue: 268,
  },
  {
    kind: 'text',
    text: 'All you need to reach the IDEEZA platform is a computer and a steady internet connection. Turn your ideas into something you can hold.',
  },
  { kind: 'heading', text: 'IDEEZA AI Model' },
  {
    kind: 'text',
    text: 'The IDEEZA AI model is designed to turn ideas into realities by helping people build products with no specialist skills and no workshop. It gives you a fully designed PCB, the firmware for it, an enclosure with the assembly worked out, and in the end a route to monetising the product through the NFT blockchain.',
  },
  { kind: 'heading', text: 'Summary' },
  {
    kind: 'figure',
    caption: 'Through-hole components laid out before assembly',
    hue: 32,
  },
  {
    kind: 'text',
    text: 'One of the advantages of IDEEZA is that it is a cloud tool, reachable from any browser. Living in the cloud makes it reachable anywhere, and it means a team can work on one design without anybody posting files to anybody.',
  },
  {
    kind: 'text',
    text: 'Because IDEEZA is an online platform, it is built for collaboration and can support the kind of workflows found in larger engineering organisations. Several people can share access to one project, and it is not always obvious how much of a project someone should see — so access is set per person rather than per team.',
  },
  { kind: 'heading', text: 'The Community Library' },
  {
    kind: 'text',
    text: 'The community library in IDEEZA embodies its commitment to collaboration. Designs for sharing parts and projects are free, and they can be reviewed and reused by others in the community — so the community faster and more efficiently.',
  },
];

/**
 * The six categories the index shows, in the order the Figma grid has them.
 *
 * Only the first carries written lessons. The others state their shape — how
 * many topics and videos they will hold — and say plainly that the writing has
 * not been done, rather than opening onto an empty page dressed as a full one.
 */
export const TUTORIAL_CATEGORIES: readonly TutorialCategory[] = Object.freeze([
  {
    id: 'code-tech',
    title: 'Code (Tech)',
    summary:
      'AI driven product development tool from which a normal user can make products without having knowledge or resources.',
    priceLabel: '2.0 IDZ',
    hue: 268,
    chapters: [
      {
        id: 'getting-started',
        title: 'Getting started',
        lessons: [
          { id: 'introduction', title: 'Introduction', blocks: INTRO_BLOCKS },
          {
            id: 'embedding-a-project',
            title: 'Embedding an IDEEZA project',
            blocks: [
              {
                kind: 'text',
                text: 'A project can be embedded wherever it needs to be read: in a page of your own, in a supplier portal, or beside a quote. The embed carries the design, not a picture of it.',
              },
              {
                kind: 'video',
                caption: 'An embedded project opening inside another page',
                duration: '3 min',
                tokenReward: '2.0 IDZ',
                hue: 210,
              },
            ],
          },
          {
            id: 'intro-to-collaboration',
            title: 'Intro to collaboration',
            blocks: [
              {
                kind: 'text',
                text: 'Several people can hold one project open at once. Who may read it, who may change it and who may release it are three separate answers, set per person.',
              },
              { kind: 'heading', text: 'Sharing and permissions' },
              {
                kind: 'text',
                text: 'Sharing a project does not hand over the right to change it. A reader sees the design as it stands; an editor moves it; only a releaser can publish a revision that others will manufacture against.',
              },
            ],
          },
        ],
      },
      {
        id: 'working-with-parts',
        title: 'Working with parts',
        lessons: [
          {
            id: 'choosing-parts',
            title: 'Choosing parts that can be bought',
            blocks: [
              {
                kind: 'text',
                text: 'A design is only as good as the parts a shop can actually source. The library marks what is stocked, what has a lead time worth knowing about, and what has no second source at all.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'ideeza',
    title: 'IDEEZA',
    summary:
      'AI driven product development tool from which a normal user can make products without having knowledge or resources.',
    priceLabel: '6.0 IDZ',
    hue: 24,
    chapters: [],
  },
  {
    id: 'set-up-ideeza',
    title: 'Set Up IDEEZA',
    summary:
      'Learn about IDEEZA features and how to design PCBs faster. Take a look at all our categories for more tutorials.',
    priceLabel: '2.0 IDZ',
    hue: 196,
    chapters: [],
  },
  {
    id: 'first-product',
    title: 'First Product on IDEEZA',
    summary:
      'Learn about IDEEZA features and how to design PCBs faster. Take a look at all our categories for more tutorials.',
    priceLabel: '20.0 IDZ',
    hue: 152,
    chapters: [],
  },
  {
    id: 'parts-vs-agile-modules',
    title: 'Parts Vs Agile Modules',
    summary:
      'Learn about IDEEZA features and how to design PCBs faster. Take a look at all our categories for more tutorials.',
    priceLabel: '10.0 IDZ',
    hue: 300,
    chapters: [],
  },
  {
    id: 'in-depth-analysis',
    title: 'In Depth Analysis on Projects',
    summary: 'Learn about IDEEZA features and how to design PCBs faster.',
    priceLabel: '2.0 IDZ',
    hue: 220,
    chapters: [],
  },
]);

/** How many lessons and videos a category holds, for the two pills on its card. */
export const categoryCounts = (
  category: TutorialCategory,
): { readonly topics: number; readonly videos: number } => {
  const lessons = category.chapters.flatMap((chapter) => chapter.lessons);
  return {
    topics: lessons.length,
    videos: lessons.reduce(
      (total, lesson) => total + lesson.blocks.filter((block) => block.kind === 'video').length,
      0,
    ),
  };
};

export const findCategory = (categoryId: string): TutorialCategory | undefined =>
  TUTORIAL_CATEGORIES.find((category) => category.id === categoryId);

export const findLesson = (
  category: TutorialCategory,
  lessonId: string,
): { readonly chapter: Chapter; readonly lesson: Lesson } | undefined => {
  for (const chapter of category.chapters) {
    const lesson = chapter.lessons.find((entry) => entry.id === lessonId);
    if (lesson !== undefined) return { chapter, lesson };
  }
  return undefined;
};

/** The lesson a category opens on, which is simply its first. */
export const firstLesson = (category: TutorialCategory): Lesson | undefined =>
  category.chapters[0]?.lessons[0];

/** The headings inside a lesson, which is what the page-contents list shows. */
export const lessonContents = (lesson: Lesson): readonly string[] =>
  lesson.blocks
    .filter((block) => block.kind === 'heading' && block.text !== undefined)
    .map((block) => block.text as string);
