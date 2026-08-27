'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Text,
  Textarea,
  useToast,
} from '@ideeza/ui';
import {
  raiseShortageAction,
  recordDeliveryAction,
  recordShipmentAction,
  requestCancellationAction,
} from '@/app/(app)/orders/actions.js';

export interface StockOption {
  readonly id: string;
  readonly label: string;
}

export interface OrderActsProps {
  readonly orderId: string;
  readonly productName: string;
  readonly currency: string;
  /** What the shop may do, worked out on the server from the order's state. */
  readonly canShip: boolean;
  readonly canDeliver: boolean;
  readonly canRaiseShortage: boolean;
  readonly canRequestCancellation: boolean;
  readonly stock: readonly StockOption[];
  readonly reviewWindowDays: number;
}

/**
 * The three things a shop does to an order besides moving the line.
 *
 * Each is a decision with a consequence on the other side: shipping starts the
 * clock, delivery opens the buyer's inspection window, and a shortage stops
 * production until the buyer answers it. None of them releases money — that is
 * the buyer's confirmation or the platform's, and nothing here pretends
 * otherwise.
 */
export const OrderActs = ({
  orderId,
  productName,
  currency,
  canShip,
  canDeliver,
  canRaiseShortage,
  canRequestCancellation,
  stock,
  reviewWindowDays,
}: OrderActsProps) => {
  const [open, setOpen] = useState<'ship' | 'deliver' | 'shortage' | 'cancel' | null>(
    null,
  );
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [reference, setReference] = useState('');
  const [partName, setPartName] = useState('');
  const [shortfall, setShortfall] = useState('');
  const [note, setNote] = useState('');
  const [substitute, setSubstitute] = useState('');
  const [justification, setJustification] = useState('');
  const [priceImpact, setPriceImpact] = useState('');
  const [credit, setCredit] = useState('');
  const [delay, setDelay] = useState('');
  const [restock, setRestock] = useState('');
  const [reason, setReason] = useState('');

  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const run = (
    act: () => Promise<{ readonly done: boolean; readonly error?: string }>,
    success: { readonly title: string; readonly body: string },
  ): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await act();
      if (!result.done) {
        setError(result.error ?? 'That did not go through.');
        return;
      }
      setOpen(null);
      push({ ...success, tone: 'success' });
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {canShip && (
          <Button
            variant="primary"
            className="w-full justify-center"
            onClick={() => setOpen('ship')}
          >
            Record the shipment
          </Button>
        )}
        {canDeliver && (
          <Button
            variant="primary"
            className="w-full justify-center"
            onClick={() => setOpen('deliver')}
          >
            Record delivery
          </Button>
        )}
        {canRaiseShortage && (
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={() => setOpen('shortage')}
          >
            Raise a part shortage
          </Button>
        )}
        {canRequestCancellation && (
          <Button
            variant="ghost"
            className="w-full justify-center"
            onClick={() => setOpen('cancel')}
          >
            Ask IDEEZA to cancel
          </Button>
        )}
      </div>

      <Modal
        open={open === 'ship'}
        onClose={() => setOpen(null)}
        title="Record the shipment"
        description="It completes the shipped stage and the buyer can follow it."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(() => recordShipmentAction(orderId, courier, tracking), {
                  title: 'Shipment recorded',
                  body: 'The buyer sees the courier and the tracking reference.',
                })
              }
            >
              Record it
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Courier" required>
            <Input
              value={courier}
              placeholder="eg. DHL Express"
              onChange={(event) => setCourier(event.target.value)}
            />
          </FormField>
          <FormField label="Tracking reference" required>
            <Input
              value={tracking}
              placeholder="eg. 1Z999AA10123456784"
              onChange={(event) => setTracking(event.target.value)}
            />
          </FormField>
          <Alert tone="info" title="This does not release your money">
            The payout is released against a documented event: the buyer confirming
            delivery, the review window closing, or a resolved issue.
          </Alert>
          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>

      <Modal
        open={open === 'deliver'}
        onClose={() => setOpen(null)}
        title="Record delivery"
        description={`It opens the buyer's ${reviewWindowDays}-day inspection window.`}
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(() => recordDeliveryAction(orderId, deliveryNote), {
                  title: 'Delivery recorded',
                  body: 'The buyer has been asked to confirm it.',
                })
              }
            >
              Record it
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField
            label="What the courier reported"
            hint="Optional. Who signed for it, when it arrived."
          >
            <Textarea
              rows={3}
              value={deliveryNote}
              onChange={(event) => setDeliveryNote(event.target.value)}
            />
          </FormField>
          <Alert tone="warning" title="Only the buyer can confirm delivery">
            Saying it arrived starts their {reviewWindowDays}-day window. Their
            confirmation, or that window closing, is what releases the money — not
            this.
          </Alert>
          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>

      <Modal
        open={open === 'shortage'}
        onClose={() => setOpen(null)}
        title="Raise a part shortage"
        description="Production stops until the buyer answers it, and the terms cannot change without them."
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(
                  () =>
                    raiseShortageAction({
                      orderId,
                      partReference: reference,
                      partName,
                      shortfallQuantity: shortfall,
                      note,
                      suggestedInventoryItemId: substitute,
                      technicalJustification: justification,
                      priceImpactMajor: priceImpact,
                      creditMajor: credit,
                      leadTimeImpactDays: delay,
                      restockLeadTimeDays: restock,
                    }),
                  {
                    title: 'Shortage raised',
                    body: 'The buyer has three answers to choose from, and production holds until they do.',
                  },
                )
              }
            >
              Raise it
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Reference" required hint="The BOM line, eg. U2.">
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </FormField>
            <FormField label="Part name" required>
              <Input
                value={partName}
                onChange={(event) => setPartName(event.target.value)}
              />
            </FormField>
            <FormField label="How many short" required>
              <Input
                inputMode="numeric"
                value={shortfall}
                onChange={(event) => setShortfall(event.target.value)}
              />
            </FormField>
          </div>

          <FormField
            label="What happened"
            required
            hint="The buyer decides on this, so give them the reason."
          >
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Substitute from your stock"
              hint="Optional. Offering one gives the buyer something to approve."
            >
              <Select
                options={[
                  { value: '', label: 'No substitute offered' },
                  ...stock.map((option) => ({ value: option.id, label: option.label })),
                ]}
                value={substitute}
                onChange={(event) => setSubstitute(event.target.value)}
              />
            </FormField>
            <FormField label="Why it can stand in" hint="Required if you offer one.">
              <Textarea
                rows={2}
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField
              label={`Price impact (${currency})`}
              hint="If the substitute costs more."
            >
              <Input
                inputMode="decimal"
                value={priceImpact}
                onChange={(event) => setPriceImpact(event.target.value)}
              />
            </FormField>
            <FormField
              label={`Credit (${currency})`}
              hint="If the buyer drops the part."
            >
              <Input
                inputMode="decimal"
                value={credit}
                onChange={(event) => setCredit(event.target.value)}
              />
            </FormField>
            <FormField label="Extra days" hint="If the substitute is slower.">
              <Input
                inputMode="numeric"
                value={delay}
                onChange={(event) => setDelay(event.target.value)}
              />
            </FormField>
            <FormField label="Restock in (days)" hint="If they choose to wait.">
              <Input
                inputMode="numeric"
                value={restock}
                onChange={(event) => setRestock(event.target.value)}
              />
            </FormField>
          </div>

          <Alert tone="info" title="The buyer has three answers">
            Approve your substitute, drop the part for the credit, or wait for stock.
            Whichever they choose is recorded against the order — the frozen terms are
            never edited, and the difference is carried as an adjustment.
          </Alert>
          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>

      <Modal
        open={open === 'cancel'}
        onClose={() => setOpen(null)}
        title="Ask IDEEZA to cancel this order"
        description="You cannot cancel a funded order yourself, and neither can the buyer."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Keep building
            </Button>
            <Button
              variant="danger"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(() => requestCancellationAction(orderId, reason), {
                  title: 'Cancellation requested',
                  body: 'IDEEZA operations decides, and the buyer has been told.',
                })
              }
            >
              Request it
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Text>
            The buyer&rsquo;s money is held against {productName}. Operations decides what
            happens to it, which is what stops either side walking away with both the
            work and the funds.
          </Text>
          <FormField label="Why it cannot be built" required>
            <Textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>
    </>
  );
};
