'use client';

import { useState } from 'react';
import { Alert, Avatar, Badge, Breadcrumbs, Button, Card, CardFooter, CardHeader, Checkbox, DataTable, DefinitionList, Divider, Drawer, DropdownMenu, EmptyState, ErrorState, FormField, Heading, Icon, IconButton, Input, LoadingState, Modal, Pagination, Radio, RadioGroup, SearchInput, Select, Skeleton, SkeletonRows, Spinner, StatusChip, StatusDot, Switch, TabPanel, Tabs, Tag, Text, Textarea, Tooltip, useToast } from '@ideeza/ui';

const Section = ({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-4">
    <div>
      <Heading level={2}>{title}</Heading>
      {description !== undefined && (
        <Text tone="muted" className="mt-1">
          {description}
        </Text>
      )}
    </div>
    <Card>{children}</Card>
  </section>
);

const Row = ({ children }: { readonly children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3">{children}</div>
);

interface DemoRow {
  readonly id: string;
  readonly manufacturer: string;
  readonly leadTime: string;
  readonly total: string;
  readonly status: string;
}

const DEMO_ROWS: readonly DemoRow[] = [
  { id: 'q-1', manufacturer: 'PrecisionCircuit Co.', leadTime: '24 days', total: '$3,950.00', status: 'accepted' },
  { id: 'q-2', manufacturer: 'Shenzhen Boards', leadTime: '35 days', total: '$3,700.00', status: 'rejected' },
  { id: 'q-3', manufacturer: 'Baltic PCB', leadTime: '18 days', total: '$4,310.00', status: 'expired' },
];

export const DesignSystemGallery = () => {
  const [tab, setTab] = useState('overview');
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { push } = useToast();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <Heading level={1}>Design system</Heading>
        <Text tone="muted">
          Every component the buyer surface is built from, with the tokens taken
          from the IDEEZA design system and the User Panel V2 file.
        </Text>
      </header>

      <Section title="Colour and type" description="Brand, text, surface, border and status tokens.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Brand', 'bg-bg-brand'],
            ['Brand hover', 'bg-bg-brand-hover'],
            ['Brand weak', 'bg-bg-brand-subtle'],
            ['Accent', 'bg-bg-warning'],
            ['Canvas', 'bg-bg-page'],
            ['Surface', 'bg-bg-surface border border-border-subtle'],
            ['Success', 'bg-bg-success'],
            ['Warning', 'bg-bg-warning'],
            ['Danger', 'bg-bg-error'],
            ['Info', 'bg-bg-info'],
            ['Neutral', 'bg-gray-600'],
            ['Raised', 'bg-bg-surface-raised'],
          ].map(([label, className]) => (
            <div key={label} className="flex items-center gap-3">
              <span className={`h-10 w-10 rounded-md ${className ?? ''}`} aria-hidden />
              <span className="text-sm text-text-secondary">{label}</span>
            </div>
          ))}
        </div>
        <Divider className="my-6" />
        <div className="flex flex-col gap-2">
          <Heading level={1}>Heading level 1</Heading>
          <Heading level={2}>Heading level 2</Heading>
          <Heading level={3}>Heading level 3</Heading>
          <Heading level={4}>Heading level 4</Heading>
          <Text size="base">Body base — 16 / 24</Text>
          <Text size="sm">Body small — 14 / 20</Text>
          <Text size="xs" tone="muted">
            Caption — 12 / 16
          </Text>
        </div>
      </Section>

      <Section title="Buttons" description="Six variants, five heights, plus loading and disabled.">
        <div className="flex flex-col gap-4">
          <Row>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tonal">Tonal</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </Row>
          <Row>
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">Extra large</Button>
          </Row>
          <Row>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <IconButton
              label="Notifications"
              badge={3}
              icon={
                <Icon name="bell" />
              }
            />
            <Spinner label="Working" />
          </Row>
        </div>
      </Section>

      <Section title="Forms" description="Label, hint and error are one unit; every control is labelled.">
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Quantity" hint="Units in this production run." required>
            <Input type="number" defaultValue={500} min={1} />
          </FormField>
          <FormField label="Tolerance" error="Tolerance is required before a request can be sent.">
            <Input placeholder="+/-0.2mm" />
          </FormField>
          <FormField label="Manufacturing method">
            <Select
              placeholder="Choose a method"
              defaultValue=""
              options={[
                { value: 'pcb', label: 'PCB fabrication' },
                { value: 'pcba', label: 'PCB fabrication + assembly' },
                { value: 'sla', label: 'SLA enclosure' },
              ]}
            />
          </FormField>
          <FormField label="Notes" hint="Anything the manufacturer should know.">
            <Textarea placeholder="Panelisation is left to the manufacturer." />
          </FormField>
          <div className="flex flex-col gap-3">
            <Checkbox label="Assembly required" description="SMT, double sided" defaultChecked />
            <Checkbox label="Testing required" />
            <Switch label="Allow approved substitutions" defaultChecked />
          </div>
          <RadioGroup legend="Substitution policy">
            <Radio name="policy" label="Not allowed" />
            <Radio name="policy" label="With approval" defaultChecked />
            <Radio name="policy" label="Manufacturer discretion" />
          </RadioGroup>
          <div className="md:col-span-2">
            <SearchInput placeholder="Search by manufacturer name…" />
          </div>
        </div>
      </Section>

      <Section title="Status and tags" description="One mapping from a domain status to a label and a tone.">
        <div className="flex flex-col gap-4">
          <Row>
            {['awaiting_payment', 'confirmed', 'in_production', 'quality_check', 'shipped', 'delivered', 'completed'].map(
              (status) => (
                <StatusChip key={status} status={status} withDot />
              ),
            )}
          </Row>
          <Row>
            {['quoted', 'declined', 'expired', 'revision_requested', 'refund_requested', 'disputed', 'refunded'].map(
              (status) => (
                <StatusChip key={status} status={status} />
              ),
            )}
          </Row>
          <Row>
            <Tag>2-layer</Tag>
            <Tag>1.6 mm</Tag>
            <Tag>FR-4</Tag>
            <Tag>ENIG</Tag>
            <Tag tone="brand">IPC Class 3</Tag>
            <Badge tone="brand">04</Badge>
            <Badge tone="neutral">12</Badge>
            <StatusDot tone="success" label="Meets board spec" />
            <StatusDot tone="danger" label="Cannot build this" />
            <Avatar name="Nova Robotics" />
          </Row>
        </div>
      </Section>

      <Section title="Tabs, breadcrumbs and paging">
        <div className="flex flex-col gap-5">
          <Breadcrumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Quote requests', href: '/manufacturing/rfq' },
              { label: 'Compare' },
            ]}
          />
          <Tabs
            items={[
              { id: 'overview', label: 'Overview', count: 4 },
              { id: 'files', label: 'Production files', count: 6 },
              { id: 'bom', label: 'BOM / parts', count: 20 },
            ]}
            activeId={tab}
            onSelect={setTab}
          />
          <TabPanel id="overview" activeId={tab}>
            <Text>The overview panel.</Text>
          </TabPanel>
          <TabPanel id="files" activeId={tab}>
            <Text>The production files panel.</Text>
          </TabPanel>
          <TabPanel id="bom" activeId={tab}>
            <Text>The bill of materials panel.</Text>
          </TabPanel>
          <Pagination page={2} pageCount={7} />
        </div>
      </Section>

      <Section title="Tables and detail lists">
        <div className="flex flex-col gap-6">
          <DataTable
            caption="Quotes received for this request"
            rows={DEMO_ROWS}
            rowKey={(row) => row.id}
            columns={[
              { id: 'manufacturer', header: 'Manufacturer', cell: (row) => row.manufacturer },
              { id: 'lead', header: 'Lead time', cell: (row) => row.leadTime, hideBelowLg: true },
              { id: 'total', header: 'Total', cell: (row) => row.total, align: 'right' },
              {
                id: 'status',
                header: 'Status',
                align: 'right',
                cell: (row) => <StatusChip status={row.status} />,
              },
              {
                id: 'actions',
                header: '',
                align: 'right',
                cell: () => (
                  <DropdownMenu
                    items={[
                      { id: 'view', label: 'View details' },
                      { id: 'message', label: 'Message manufacturer' },
                      { id: 'decline', label: 'Decline quote', tone: 'danger' },
                    ]}
                    trigger={({ ref, onClick, ...aria }) => (
                      <button
                        ref={ref}
                        type="button"
                        onClick={onClick}
                        aria-label="Row actions"
                        className="rounded-md px-2 py-1 text-text-secondary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                        {...aria}
                      >
                        ⋯
                      </button>
                    )}
                  />
                ),
              },
            ]}
          />
          <DefinitionList
            columns={2}
            items={[
              { label: 'Unit price', value: '$7.90' },
              { label: 'Quantity', value: '500 pcs' },
              { label: 'Lead time', value: '24 days' },
              { label: 'Shipping estimate', value: '$28.00' },
              { label: 'Quote expires', value: '31 May 2026' },
              { label: 'Warranty', value: '90 days' },
            ]}
          />
        </div>
      </Section>

      <Section title="Overlays and feedback">
        <div className="flex flex-col gap-5">
          <Row>
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
              Open drawer
            </Button>
            <Button
              variant="tonal"
              onClick={() =>
                push({
                  title: 'Request sent',
                  body: 'Three manufacturers were asked to quote.',
                  tone: 'success',
                })
              }
            >
              Show toast
            </Button>
            <Tooltip content="Funds are held by the platform until you confirm delivery.">
              <span className="text-sm font-medium text-text-brand underline decoration-dotted">
                What does secured mean?
              </span>
            </Tooltip>
          </Row>

          <Alert
            tone="warning"
            title="Parts review required"
            actions={<Button size="sm" variant="secondary">Review parts</Button>}
          >
            The manufacturer suggested replacements for two unavailable
            components. Approve them before accepting the quote.
          </Alert>
          <Alert tone="info" title="Funds are held by IDEEZA until delivery is confirmed." />
          <Alert tone="danger" title="Payment failed. The order was not confirmed." />
          <Alert tone="success" title="Delivery confirmed. The payout will be released." />

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Request a refund"
            description="Refund requests need evidence, because a manufacturing claim is decided on the record."
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setModalOpen(false)}>Send request</Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <FormField label="Reason" required>
                <Select
                  defaultValue=""
                  placeholder="Choose a reason"
                  options={[
                    { value: 'failed_quality_check', label: 'Failed quality check' },
                    { value: 'wrong_specification', label: 'Wrong specification' },
                    { value: 'wrong_quantity', label: 'Wrong quantity' },
                  ]}
                />
              </FormField>
              <FormField label="What happened" required>
                <Textarea placeholder="Twelve boards failed the agreed functional test on arrival." />
              </FormField>
            </div>
          </Modal>

          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="Quote details"
            description="PrecisionCircuit Co."
            footer={
              <>
                <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
                  Reject
                </Button>
                <Button onClick={() => setDrawerOpen(false)}>Accept and continue</Button>
              </>
            }
          >
            <DefinitionList
              items={[
                { label: 'Unit price', value: '$7.90' },
                { label: 'Total', value: '$3,950.00' },
                { label: 'Lead time', value: '24 days' },
                { label: 'Shipping', value: '$28.00' },
                { label: 'Expires', value: '31 May 2026' },
              ]}
            />
          </Drawer>
        </div>
      </Section>

      <Section title="Empty, loading and error states">
        <div className="grid gap-5 lg:grid-cols-3">
          <EmptyState
            title="No quotes yet"
            description="The manufacturers you selected have not answered. You can withdraw the request while it is unanswered."
            action={<Button size="sm" variant="secondary">Withdraw request</Button>}
          />
          <LoadingState label="Loading quotes" />
          <ErrorState onRetry={() => undefined} />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-40" />
            <SkeletonRows rows={2} />
          </div>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="PrecisionCircuit Co."
              description="Shenzhen, CN · 4.9 rating · 98% on time"
              actions={<StatusChip status="quoted" />}
            />
            <DefinitionList
              className="mt-4"
              items={[
                { label: 'Lead time', value: '24 days' },
                { label: 'Minimum order', value: '5 pcs' },
              ]}
            />
            <CardFooter>
              <Button variant="secondary" size="sm">
                View details
              </Button>
              <Button size="sm">Request quote</Button>
            </CardFooter>
          </Card>
          <Card tone="warning">
            <CardHeader title="Inventory check required before quoting" />
            <Text className="mt-2">
              Two components need a replacement before production can start.
            </Text>
          </Card>
        </div>
      </Section>
    </div>
  );
};
