'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  FormField,
  Input,
  Modal,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import {
  sendRequestAction,
  type SendRequestState,
} from '@/app/(app)/manufacturing/rfq/actions.js';
import { goTo } from '@/lib/navigate.js';

export interface ManufacturerChoice {
  readonly id: string;
  readonly displayName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly rating: number | null;
  readonly onTimeDeliveryRate: number | null;
  readonly completedOrderCount: number;
  readonly verified: boolean;
  readonly services: readonly string[];
  readonly certifications: readonly string[];
  readonly minimumOrderQuantity: number | null;
  readonly standardLeadTimeDays: number | null;
}

export interface SendRequestFormProps {
  readonly rfqId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly currency: string;
  readonly manufacturers: readonly ManufacturerChoice[];
  readonly deliveryAddress: {
    readonly line1: string;
    readonly line2: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
    readonly countryCode: string;
  };
  readonly maxRecipients: number;
}

/**
 * Choosing who receives the request, and the terms they answer.
 *
 * Sending is the point of no return for the requirements, so the button
 * confirms first and says exactly how many manufacturers will receive it.
 */
export const SendRequestForm = ({
  rfqId,
  productName,
  quantity,
  currency,
  manufacturers,
  deliveryAddress,
  maxRecipients,
}: SendRequestFormProps) => {
  const router = useRouter();
  const [state, action, pending] = useActionState<SendRequestState, FormData>(
    sendRequestAction,
    {},
  );
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state.redirectTo !== undefined) goTo(router, state.redirectTo);
  }, [state.redirectTo, router]);

  const toggle = (id: string, checked: boolean): void => {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((entry) => entry !== id),
    );
  };

  const tooMany = selected.length > maxRecipients;
  const belowMoq = manufacturers.filter(
    (manufacturer) =>
      selected.includes(manufacturer.id) &&
      manufacturer.minimumOrderQuantity !== null &&
      quantity < manufacturer.minimumOrderQuantity,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="rfqId" value={rfqId} />

      {state.error !== undefined && (
        <Alert tone="danger" title="This request was not sent">
          {state.error}
        </Alert>
      )}

      <Card padded={false}>
        <div className="border-b border-border-subtle p-4 md:p-6">
          <CardHeader
            title="Select manufacturers"
            description="Every manufacturer you choose answers with its own quote. You accept at most one of them, and only that one becomes an order."
            actions={
              <Badge tone={selected.length === 0 ? 'neutral' : 'brand'}>
                {selected.length} selected
              </Badge>
            }
          />
        </div>
        <ul aria-label="Manufacturers" className="flex flex-col">
          {manufacturers.map((manufacturer) => (
            <li key={manufacturer.id} className="border-b border-border-subtle p-4 last:border-0 md:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Checkbox
                  name="manufacturerIds"
                  value={manufacturer.id}
                  checked={selected.includes(manufacturer.id)}
                  onChange={(event) => toggle(manufacturer.id, event.target.checked)}
                  label={
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-text-primary">
                        {manufacturer.displayName}
                      </span>
                      {manufacturer.verified && <Badge tone="success">Verified</Badge>}
                    </span>
                  }
                  description={
                    <span className="flex flex-col gap-0.5">
                      <span>
                        {manufacturer.city}, {manufacturer.countryCode}
                        {manufacturer.rating === null
                          ? ''
                          : ` · ${manufacturer.rating.toFixed(1)} rating`}
                        {manufacturer.onTimeDeliveryRate === null
                          ? ''
                          : ` · ${Math.round(manufacturer.onTimeDeliveryRate * 100)}% on time`}
                        {` · ${manufacturer.completedOrderCount} completed orders`}
                      </span>
                      <span>
                        {manufacturer.services.join(', ')}
                        {manufacturer.minimumOrderQuantity === null
                          ? ''
                          : ` · MOQ ${manufacturer.minimumOrderQuantity}`}
                        {manufacturer.standardLeadTimeDays === null
                          ? ''
                          : ` · usually ${manufacturer.standardLeadTimeDays} days`}
                      </span>
                      {manufacturer.certifications.length > 0 && (
                        <span>{manufacturer.certifications.join(' · ')}</span>
                      )}
                    </span>
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {tooMany && (
        <Alert tone="warning" title="Too many manufacturers">
          A request may be routed to at most {maxRecipients} manufacturers.
        </Alert>
      )}

      {belowMoq.length > 0 && (
        <Alert tone="warning" title="Below a minimum order quantity">
          {belowMoq.map((manufacturer) => manufacturer.displayName).join(', ')} normally
          {belowMoq.length === 1 ? ' asks' : ' ask'} for more than {quantity} units. They
          may decline, which is a normal answer to a request.
        </Alert>
      )}

      <Card>
        <CardHeader
          title="What to price"
          description="Optional, and all of it is visible to every recipient."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Volume tiers"
            hint={`Other quantities to price, for example 250, 500. The request itself is for ${quantity}.`}
            error={state.fieldErrors?.['volumeTiers']}
          >
            <Input name="volumeTiers" placeholder="250, 500" />
          </FormField>
          <FormField
            label={`Target price per unit (${currency})`}
            hint="What you hope to pay. Manufacturers still quote their own price."
            error={state.fieldErrors?.['targetPriceMinor']}
          >
            <Input name="targetPrice" type="number" min={0} step="0.01" />
          </FormField>
          <FormField
            label="Needed by"
            hint="When you need the units in hand."
            error={state.fieldErrors?.['neededBy']}
          >
            <Input name="neededBy" type="date" />
          </FormField>
          <FormField
            label="Quotes needed by"
            hint="After this date a recipient can no longer answer."
            error={state.fieldErrors?.['responseDeadline']}
          >
            <Input name="responseDeadline" type="date" />
          </FormField>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Deliver to"
          description="Shipping is quoted against this address."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Address line 1"
            required
            error={state.fieldErrors?.['deliveryAddress.line1']}
            className="md:col-span-2"
          >
            <Input name="line1" defaultValue={deliveryAddress.line1} required />
          </FormField>
          <FormField label="Address line 2" className="md:col-span-2">
            <Input name="line2" defaultValue={deliveryAddress.line2} />
          </FormField>
          <FormField
            label="City"
            required
            error={state.fieldErrors?.['deliveryAddress.city']}
          >
            <Input name="city" defaultValue={deliveryAddress.city} required />
          </FormField>
          <FormField label="Region">
            <Input name="region" defaultValue={deliveryAddress.region} />
          </FormField>
          <FormField label="Postal code">
            <Input name="postalCode" defaultValue={deliveryAddress.postalCode} />
          </FormField>
          <FormField
            label="Country code"
            required
            error={state.fieldErrors?.['deliveryAddress.countryCode']}
          >
            <Input
              name="countryCode"
              maxLength={2}
              defaultValue={deliveryAddress.countryCode}
              required
            />
          </FormField>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/manufacturing/draft/${rfqId}`}
          className={buttonAppearance({ variant: 'ghost' })}
        >
          Back to the draft
        </Link>
        <Button
          size="lg"
          disabled={selected.length === 0 || tooMany}
          onClick={() => setConfirming(true)}
        >
          Send request
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Send this request to ${selected.length} ${selected.length === 1 ? 'manufacturer' : 'manufacturers'}?`}
        description="The requirements are locked when the request is sent, so every quote answers the same question."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
            <Button type="submit" loading={pending}>
              Send request
            </Button>
          </div>
        }
      >
        <Text>
          {productName} · {quantity} units. Accepting a quote later does not create
          a confirmed order on its own: the order opens awaiting payment, and it
          is confirmed once the payment is secured.
        </Text>
      </Modal>
    </form>
  );
};
