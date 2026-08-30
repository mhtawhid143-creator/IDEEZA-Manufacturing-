'use client';

import { useState } from 'react';
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

export interface Article {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly body: string;
  readonly status: 'draft' | 'submitted' | 'published' | 'rejected';
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
    submitted: 'warning',
    published: 'success',
    rejected: 'danger',
  };

const STATUS_LABEL: Readonly<Record<Article['status'], string>> = {
  draft: 'Draft',
  submitted: 'With IDEEZA',
  published: 'Published',
  rejected: 'Sent back',
};

const readMinutes = (body: string): number =>
  Math.max(1, Math.round(body.trim().split(/\s+/).filter(Boolean).length / 200));

/**
 * The blog, as a shop uses it: write, send for review, and read what came back.
 *
 * IDEEZA reviews an article before it appears on a shop's profile, which is why
 * "submitted" and "sent back with a reason" are states rather than a publish
 * button that does everything. Articles live in this screen for now — the tables
 * they need arrive with the logic pass, and the screen says so rather than
 * implying a draft is safe.
 */
export const BlogWorkspace = ({
  shopName,
  seed,
}: {
  readonly shopName: string;
  readonly seed: readonly Article[];
}) => {
  const [articles, setArticles] = useState<readonly Article[]>(seed);
  const [tab, setTab] = useState('all');
  const [editing, setEditing] = useState<Article | null>(null);
  const [reading, setReading] = useState<Article | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0] ?? 'Manufacturing');
  const [tags, setTags] = useState('');
  const [body, setBody] = useState('');
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

  const save = (status: Article['status']): void => {
    const draft = editing;
    if (draft === null) return;
    if (title.trim() === '' || body.trim().length < 50) {
      push({
        title: 'Not ready to save',
        body: 'An article needs a title and at least a few sentences.',
        tone: 'danger',
      });
      return;
    }

    const next: Article = {
      ...draft,
      title: title.trim(),
      category,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ''),
      body: body.trim(),
      status,
      on: new Date().toISOString().slice(0, 10),
      rejectReason: status === 'submitted' ? null : draft.rejectReason,
      readMinutes: readMinutes(body),
    };

    setArticles((current) =>
      current.some((article) => article.id === next.id)
        ? current.map((article) => (article.id === next.id ? next : article))
        : [next, ...current],
    );
    setEditing(null);
    push({
      title: status === 'submitted' ? 'Sent for review' : 'Draft saved',
      body:
        status === 'submitted'
          ? 'IDEEZA reads it before it appears on your profile.'
          : 'Kept in this screen for now.',
      tone: 'success',
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
                id: 'submitted',
                label: 'With IDEEZA',
                count: articles.filter((article) => article.status === 'submitted').length,
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
                className="h-28 w-full rounded-t-xl bg-gradient-to-br from-bg-brand-subtle via-blue-100 to-bg-page"
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
                    <Button variant="secondary" size="sm" onClick={() => open(article)}>
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Alert tone="info" title="Articles are held in this screen for now">
        Writing, sending for review and reading what came back all work here. The blog
        has no tables in the database yet, so nothing survives a reload — that arrives
        with the logic pass, and until then nothing here claims to have been published to
        the world.
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
            <Button variant="secondary" onClick={() => save('draft')}>
              Save as draft
            </Button>
            <Button variant="primary" onClick={() => save('submitted')}>
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
            hint="Plain paragraphs. Rich text and images arrive with the logic pass."
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
