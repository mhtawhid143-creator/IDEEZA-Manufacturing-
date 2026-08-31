import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  DataTable,
  DropdownMenu,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Modal,
  NotBuiltYet,
  Pagination,
  Radio,
  RadioGroup,
  Select,
  StatusChip,
  Switch,
  TabPanel,
  Tabs,
  Textarea,
  Tooltip,
  statusPresentation,
  buttonAppearance,
} from '../src/index.js';

describe('Button', () => {
  it('is a button, calls back and can be disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Request quote</Button>);

    const button = screen.getByRole('button', { name: 'Request quote' });
    expect(button).toHaveProperty('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <Button onClick={onClick} disabled>
        Request quote
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Request quote' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('announces itself as busy while loading and refuses clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Sending
      </Button>,
    );
    const button = screen.getByRole('button', { name: /Sending/ });
    expect(button.getAttribute('aria-busy')).toBe('true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders every variant without losing the accessible name', () => {
    for (const variant of ['primary', 'secondary', 'tonal', 'ghost', 'outline', 'danger'] as const) {
      const { unmount } = render(<Button variant={variant}>Accept quote</Button>);
      expect(screen.getByRole('button', { name: 'Accept quote' })).toBeDefined();
      unmount();
    }
  });
});

describe('FormField and controls', () => {
  it('associates the label, the hint and the error with the input', () => {
    render(
      <FormField label="Quantity" hint="Units in this run" required>
        <Input defaultValue="500" />
      </FormField>,
    );

    const input = screen.getByLabelText(/Quantity/);
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(input.getAttribute('required')).not.toBeNull();
    expect(screen.getByText('Units in this run')).toBeDefined();
  });

  it('marks the control invalid and announces the error', () => {
    render(
      <FormField label="Tolerance" error="Tolerance is required.">
        <Input />
      </FormField>,
    );

    const input = screen.getByLabelText('Tolerance');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Tolerance is required.');
  });

  it('hides a label visually but keeps it for assistive technology', () => {
    render(
      <FormField label="Search" labelHidden>
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Search')).toBeDefined();
  });

  it('supports a textarea and a select through the same field', () => {
    render(
      <>
        <FormField label="Notes">
          <Textarea />
        </FormField>
        <FormField label="Method">
          <Select
            options={[
              { value: 'pcb', label: 'PCB fabrication' },
              { value: 'pcba', label: 'PCB and assembly' },
            ]}
          />
        </FormField>
      </>,
    );
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Method').tagName).toBe('SELECT');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('gives a checkbox, a radio group and a switch real semantics', async () => {
    render(
      <>
        <Checkbox label="Assembly required" />
        <RadioGroup legend="Substitution policy">
          <Radio name="policy" label="Not allowed" />
          <Radio name="policy" label="With approval" />
        </RadioGroup>
        <Switch label="Allow substitutions" />
      </>,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Assembly required' });
    await userEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(true);

    const group = screen.getByRole('group', { name: 'Substitution policy' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);

    const toggle = screen.getByRole('switch', { name: 'Allow substitutions' });
    await userEvent.click(toggle);
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });

  it('is reachable by keyboard alone', async () => {
    render(
      <FormField label="Quantity">
        <Input />
      </FormField>,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('Quantity'));
  });
});

describe('Tabs', () => {
  it('exposes tab semantics and switches panels', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <>
        <Tabs
          items={[
            { id: 'a', label: 'Overview', count: 4 },
            { id: 'b', label: 'Files' },
          ]}
          activeId="a"
          onSelect={onSelect}
        />
        <TabPanel id="a" activeId="a">
          Overview panel
        </TabPanel>
        <TabPanel id="b" activeId="a">
          Files panel
        </TabPanel>
      </>,
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('Overview panel');
    expect(screen.getByText('04')).toBeDefined();

    await userEvent.click(screen.getByRole('tab', { name: /Files/ }));
    expect(onSelect).toHaveBeenCalledWith('b');

    rerender(
      <>
        <Tabs items={[{ id: 'a', label: 'Overview' }, { id: 'b', label: 'Files' }]} activeId="b" />
        <TabPanel id="b" activeId="b">
          Files panel
        </TabPanel>
      </>,
    );
    expect(screen.getByRole('tabpanel').textContent).toBe('Files panel');
  });

  it('renders as navigation when the tabs are routes', () => {
    render(
      <Tabs
        items={[
          { id: 'a', label: 'Draft', href: '/manufacturing?tab=draft' },
          { id: 'b', label: 'Orders', href: '/manufacturing?tab=active' },
        ]}
        activeId="a"
        linkComponent={({ href, className, children, ...aria }) => (
          <a href={href} className={className} {...aria}>
            {children}
          </a>
        )}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Draft' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('DropdownMenu', () => {
  it('opens, runs an item and closes with Escape', async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        items={[
          { id: 'view', label: 'View details', onSelect },
          { id: 'refund', label: 'Request refund', tone: 'danger' },
        ]}
        trigger={({ ref, onClick, ...aria }) => (
          <button ref={ref} type="button" onClick={onClick} {...aria}>
            Row actions
          </button>
        )}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Row actions' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');

    await userEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'View details' }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();

    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Modal', () => {
  it('is a labelled dialog, traps focus and closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Request a refund" description="Evidence is required.">
        <button type="button">Inside</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByRole('heading', { name: 'Request a refund' })).toBeDefined();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => undefined} title="Hidden" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('status presentation', () => {
  it('never labels an unfunded order as accepted', () => {
    expect(statusPresentation('awaiting_payment')).toEqual({
      label: 'Awaiting payment',
      tone: 'warning',
    });
    render(<StatusChip status="awaiting_payment" />);
    expect(screen.getByText('Awaiting payment')).toBeDefined();
  });

  it('maps the order lifecycle to distinct tones', () => {
    expect(statusPresentation('confirmed').tone).toBe('brand');
    expect(statusPresentation('delivered').tone).toBe('success');
    expect(statusPresentation('disputed').tone).toBe('danger');
    expect(statusPresentation('refund_requested').tone).toBe('warning');
    expect(statusPresentation('expired').tone).toBe('neutral');
  });

  it('falls back readably for an unknown status', () => {
    expect(statusPresentation('some_new_state')).toEqual({
      label: 'some new state',
      tone: 'neutral',
    });
  });
});

describe('feedback and empty states', () => {
  it('announces a danger alert immediately and a neutral one politely', () => {
    const { unmount } = render(<Alert tone="danger" title="Payment failed" />);
    expect(screen.getByRole('alert').textContent).toContain('Payment failed');
    unmount();

    render(<Alert tone="info" title="Funds are held until delivery" />);
    expect(screen.getByRole('status').textContent).toContain('Funds are held');
  });

  it('offers a way forward from an empty state and a retry from an error', async () => {
    const onRetry = vi.fn();
    render(
      <>
        <EmptyState title="No quotes yet" action={<Button size="sm">Withdraw</Button>} />
        <ErrorState onRetry={onRetry} />
        <LoadingState label="Loading quotes" />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByText(/Loading quotes/)).toBeDefined();
  });

  it('says plainly when a screen is not built yet', () => {
    render(<NotBuiltYet title="Compare quotes" plannedIn="the quote comparison task" />);
    expect(screen.getByText('Not implemented yet')).toBeDefined();
    expect(screen.getByRole('region', { name: /not implemented yet/i })).toBeDefined();
  });
});

describe('DataTable', () => {
  const rows = [
    { id: '1', name: 'PrecisionCircuit Co.', status: 'quoted' },
    { id: '2', name: 'Shenzhen Boards', status: 'declined' },
  ];

  it('renders a real table with a caption and column headers', () => {
    render(
      <DataTable
        caption="Quotes received"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          { id: 'name', header: 'Manufacturer', cell: (row) => row.name },
          { id: 'status', header: 'Status', cell: (row) => <StatusChip status={row.status} /> },
        ]}
      />,
    );

    expect(screen.getByRole('table', { name: 'Quotes received' })).toBeDefined();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('shows the empty state instead of an empty table', () => {
    render(
      <DataTable
        caption="Quotes received"
        rows={[]}
        rowKey={(row: { id: string }) => row.id}
        columns={[]}
        emptyState={<EmptyState title="No quotes yet" />}
      />,
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('No quotes yet')).toBeDefined();
  });
});

describe('navigation helpers', () => {
  it('marks the current crumb and links the rest', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Manufacturing', href: '/manufacturing' },
          { label: 'Compare' },
        ]}
        linkComponent={({ href, className, children }) => (
          <a href={href} className={className}>
            {children}
          </a>
        )}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Manufacturing' })).toBeDefined();
    expect(screen.getByText('Compare').getAttribute('aria-current')).toBe('page');
  });

  it('pages with an accessible current page', async () => {
    const onChange = vi.fn();
    render(<Pagination page={2} pageCount={5} onChange={onChange} />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeDefined();
    expect(screen.getByRole('button', { name: '2' }).getAttribute('aria-current')).toBe('page');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('keeps an icon only control named, and a badge decorative', () => {
    render(<Avatar name="Nova Robotics" />);
    expect(screen.getByText('Nova Robotics')).toBeDefined();
    render(<Badge tone="brand">04</Badge>);
    expect(screen.getByText('04')).toBeDefined();
  });
});

describe('Tooltip', () => {
  it('describes its trigger and opens on focus', async () => {
    render(
      <Tooltip content="Funds are held by the platform.">
        <span>What does secured mean?</span>
      </Tooltip>,
    );
    const trigger = screen.getByText('What does secured mean?').parentElement;
    expect(trigger?.getAttribute('aria-describedby')).toBeTruthy();

    await userEvent.tab();
    expect(screen.getByRole('tooltip').textContent).toBe('Funds are held by the platform.');
  });
});

describe('Card', () => {
  it('renders its content in a region-free container by default', () => {
    render(
      <Card>
        <p>Quote details</p>
      </Card>,
    );
    expect(screen.getByText('Quote details')).toBeDefined();
  });
});

describe('product availability presentation', () => {
  it('reads available as a success state and unavailable as a plain one', () => {
    expect(statusPresentation('available')).toEqual({
      label: 'Available',
      tone: 'success',
    });
    expect(statusPresentation('unavailable')).toEqual({
      label: 'Currently unavailable',
      tone: 'neutral',
    });
  });

  it('renders the chip a product card uses', () => {
    render(<StatusChip status="unavailable" />);
    expect(screen.getByText('Currently unavailable')).toBeDefined();
  });
});

describe('buttonAppearance', () => {
  it('gives a link the same look as the button without nesting one inside it', () => {
    const asLink = buttonAppearance({ variant: 'secondary', size: 'sm' });
    render(
      <a href="/favorites" className={asLink}>
        Go to Favorites
      </a>,
    );
    const link = screen.getByRole('link', { name: 'Go to Favorites' });
    expect(link.className).toBe(asLink);
    expect(link.querySelector('button')).toBeNull();
  });

  it('keeps the focus ring and the disabled treatment in the shared base', () => {
    const classes = buttonAppearance();
    expect(classes).toContain('focus-visible:ring-focus');
    expect(classes).toContain('disabled:bg-button-disabled-bg');
  });
});
