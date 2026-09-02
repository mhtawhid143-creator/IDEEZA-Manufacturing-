'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  Modal,
  Select,
  Tabs,
  Tag,
  Text,
  Textarea,
  useToast,
} from '@ideeza/ui';

import {
  removeArticleAction,
  saveArticleAction,
} from '@/app/(app)/blog/actions.js';

export interface Article {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly body: string;
  /**
   * The database's own words. `in_review` reads as "With IDEEZA" on screen,
   * because that is what it means to the shop, but the two are not translated
   * anywhere else — one vocabulary, all the way down.
   */
  readonly status: 'draft' | 'in_review' | 'published' | 'rejected';
  readonly on: string;
  readonly rejectReason: string | null;
  readonly readMinutes: number;
}

const CATEGORIES = [
  'Manufacturing',
  'PCB design',
  'Assembly',
  'Materials',
  'Quality',
  'Case study',
];

const STATUS_TONE: Readonly<Record<Article['status'], 'neutral' | 'warning' | 'success' | 'danger'>> =
  {
    draft: 'neutral',
    in_review: 'warning',
    published: 'success',
    rejected: 'danger',
  };

const STATUS_LABEL: Readonly<Record<Article['status'], string>> = {
  draft: 'Draft',
  in_review: 'With IDEEZA',
  published: 'Published',
  rejected: 'Sent back',
};

/**
 * The blog, as a shop uses it: write, send for review, and read what came back.
 *
 * IDEEZA reviews an article before it appears on a shop's profile, which is why
 * "with IDEEZA" and "sent back with a reason" are states rather than a publish
 * button that does everything.
 *
 * What a shop writes here is stored. It used to live in this component's state
 * with a notice admitting it, which also meant the profile's Blog tab — reading
 * the same table this now writes — showed a shop nothing it had ever written.
 */
export const BlogWorkspace = ({
  shopName,
  seed,
}: {
  readonly shopName: string;
  readonly seed: readonly Article[];
}) => {
  const articles = seed;
  const [tab, setTab] = useState('all');
  const [editing, setEditing] = useState<Article | null>(null);
  const [reading, setReading] = useState<Article | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0] ?? 'Manufacturing');
  const [tags, setTags] = useState('');
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  const visible = articles.filter(
    (article) => tab === 'all' || article.status === tab,
  );

  const open = (article: Article | null): void => {
    setEditing(article ?? {
      id: `draft_${Date.now().toString(36)}`,
      title: '',
      category: CATEGORIES[0] ?? 'Manufacturing',
      tags: [],
      body: '',
      status: 'draft',
      on: new Date().toISOString().slice(0, 10),
      rejectReason: null,
      readMinutes: 1,
    });
    setTitle(article?.title ?? '');
    setCategory(article?.category ?? CATEGORIES[0] ?? 'Manufacturing');
    setTags((article?.tags ?? []).join(', '));
    setBody(article?.body ?? '');
  };

  const save = (status: 'draft' | 'in_review'): void => {
    const draft = editing;
    if (draft === null) return;

    startTransition(async () => {
      const result = await saveArticleAction({
        // A draft that has never been saved has an id this screen invented, and
        // sending it would ask the data layer to rewrite a row nobody has.
        ...(draft.id.startsWith('draft_') ? {} : { id: draft.id }),
        title,
        category,
        tags: tags.split(','),
        body,
        status,
      });
      if (!result.saved) {
        push({
          title: 'Not saved',
          body: result.error ?? 'That article was not saved.',
          tone: 'danger',
        });
        return;
      }
      setEditing(null);
      push({
        title: status === 'in_review' ? 'Sent for review' : 'Draft saved',
        body:
          status === 'in_review'
            ? 'IDEEZA reads it before it appears on your profile.'
            : 'Saved. It is yours until you send it.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  const drop = (articleId: string): void => {
    startTransition(async () => {
      const result = await removeArticleAction(articleId);
      if (!result.saved) {
        push({ title: result.error ?? 'It was not deleted.', tone: 'danger' });
        return;
      }
      push({ title: 'Article deleted', tone: 'success' });
      router.refresh();
    });
  };

  return (
    <>
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Tabs
            label="Article states"
            activeId={tab}
            onSelect={setTab}
            items={[
              { id: 'all', label: 'All', count: articles.length },
              {
                id: 'draft',
                label: 'Drafts',
                count: articles.filter((article) => article.status === 'draft').length,
              },
              {
                id: 'in_review',
                label: 'With IDEEZA',
                count: articles.filter((article) => article.status === 'in_review').length,
              },
              {
                id: 'published',
                label: 'Published',
                count: articles.filter((article) => article.status === 'published').length,
              },
              {
                id: 'rejected',
                label: 'Sent back',
                count: articles.filter((article) => article.status === 'rejected').length,
              },
            ]}
          />
          <Button variant="primary" onClick={() => open(null)}>
            Write an article
          </Button>
        </div>
      </Card>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing here yet"
            description="Write about what your shop is good at. IDEEZA reads it before it appears on your profile, and buyers read it there."
            action={
              <Button variant="primary" onClick={() => open(null)}>
                Write an article
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((article) => (
            <Card key={article.id} padded={false} className="flex flex-col">
              <span
                aria-hidden
                className="h-28 w-full rounded-t-xl bg-gradient-to-br from-bg-brand-subtle via-bg-info-subtle to-bg-page"
              />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Tag tone="brand">{article.category}</Tag>
                  <Tag tone={STATUS_TONE[article.status]}>
                    {STATUS_LABEL[article.status]}
                  </Tag>
                </div>
                <p className="text-sm font-semibold text-text-primary">{article.title}</p>
                <Text tone="muted" size="xs">
                  {shopName} · {article.readMinutes} min read · {article.on}
                </Text>
                <Text size="sm" className="line-clamp-3 block">
                  {article.body}
                </Text>
                {article.rejectReason !== null && (
                  <Alert tone="danger" title="Sent back by IDEEZA">
                    {article.rejectReason}
                  </Alert>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setReading(article)}>
                    Read
                  </Button>
                  {article.status !== 'published' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() => open(article)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => drop(article.id)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Alert tone="info" title="IDEEZA reads an article before buyers do">
        Drafts and articles you send are stored, and both appear on your profile&rsquo;s
        Blog tab where you can see which is which. Only IDEEZA can mark one published,
        so nothing here puts your writing in front of a buyer on its own.
      </Alert>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.title === '' ? 'Write an article' : 'Edit the article'}
        description="IDEEZA reads it before it appears on your profile."
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="secondary" loading={pending} onClick={() => save('draft')}>
              Save as draft
            </Button>
            <Button variant="primary" loading={pending} onClick={() => save('in_review')}>
              Send for review
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Title" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Category" required>
              <Select
                options={CATEGORIES.map((value) => ({ value, label: value }))}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </FormField>
            <FormField label="Tags" hint="Comma separated.">
              <Input value={tags} onChange={(event) => setTags(event.target.value)} />
            </FormField>
          </div>
          <FormField
            label="The article"
            required
            hint="Plain paragraphs. Rich text and images are not stored yet."
          >
            <Textarea
              rows={12}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={reading !== null}
        onClose={() => setReading(null)}
        title={reading?.title ?? ''}
        description={`${shopName} · ${reading?.readMinutes ?? 1} min read · ${reading?.on ?? ''}`}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setReading(null)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {reading?.rejectReason !== null && reading !== null && (
            <Alert tone="danger" title="Reject reason">
              {reading.rejectReason}
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            {(reading?.tags ?? []).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <Text size="sm" className="block whitespace-pre-line">
            {reading?.body ?? ''}
          </Text>
        </div>
      </Modal>
    </>
  );
};
