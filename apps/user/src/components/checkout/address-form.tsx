'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Checkbox,
  FormField,
  Input,
  Text,
} from '@ideeza/ui';
import {
  setAddressAction,
  type AddressState,
} from '@/app/(app)/manufacturing/checkout/actions.js';
import { goTo } from '@/lib/navigate.js';

export interface SavedAddress {
  readonly id: string;
  readonly label: string | null;
  readonly line1: string;
  readonly city: string;
  readonly countryCode: string;
}

export interface AddressFormProps {
  readonly orderId: string;
  readonly current: {
    readonly line1: string;
    readonly line2: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
    readonly countryCode: string;
  };
  readonly saved: readonly SavedAddress[];
}

/**
 * Where the finished units go.
 *
 * Editable only while the order is unpaid: once the funds are held, the address
 * is part of what the manufacturer was told.
 */
export const AddressForm = ({ orderId, current, saved }: AddressFormProps) => {
  const router = useRouter();
  const [state, action, pending] = useActionState<AddressState, FormData>(
    setAddressAction,
    {},
  );
  const [hydrated, setHydrated] = useState(false);
  const [values, setValues] = useState(current);

  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (state.saved === true) goTo(router, `/manufacturing/checkout/${orderId}`);
  }, [state.saved, router, orderId]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="orderId" value={orderId} />

      {state.error !== undefined && (
        <Alert tone="danger" title="That address was not saved">
          {state.error}
        </Alert>
      )}

      {saved.length > 0 && (
        <Card>
          <CardHeader
            title="Use a saved address"
            description="Picking one fills the form below."
          />
          <ul className="mt-3 flex flex-col gap-2">
            {saved.map((address) => (
              <li key={address.id}>
                <button
                  type="button"
                  onClick={() =>
                    setValues({
                      ...values,
                      line1: address.line1,
                      city: address.city,
                      countryCode: address.countryCode,
                    })
                  }
                  className="w-full rounded-lg border border-line px-3 py-2 text-left text-sm text-body hover:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                >
                  <span className="block font-semibold text-heading">
                    {address.label ?? 'Saved address'}
                  </span>
                  {address.line1}, {address.city}, {address.countryCode}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title="Delivery address" />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Address line 1"
            required
            error={state.fieldErrors?.['deliveryAddress.line1']}
            className="md:col-span-2"
          >
            <Input
              name="line1"
              value={values.line1}
              onChange={(event) => setValues({ ...values, line1: event.target.value })}
              required
            />
          </FormField>
          <FormField label="Address line 2" className="md:col-span-2">
            <Input
              name="line2"
              value={values.line2}
              onChange={(event) => setValues({ ...values, line2: event.target.value })}
            />
          </FormField>
          <FormField
            label="City"
            required
            error={state.fieldErrors?.['deliveryAddress.city']}
          >
            <Input
              name="city"
              value={values.city}
              onChange={(event) => setValues({ ...values, city: event.target.value })}
              required
            />
          </FormField>
          <FormField label="Region">
            <Input
              name="region"
              value={values.region}
              onChange={(event) => setValues({ ...values, region: event.target.value })}
            />
          </FormField>
          <FormField label="Postal code">
            <Input
              name="postalCode"
              value={values.postalCode}
              onChange={(event) =>
                setValues({ ...values, postalCode: event.target.value })
              }
            />
          </FormField>
          <FormField
            label="Country code"
            required
            hint="Two letters, for example BD."
            error={state.fieldErrors?.['deliveryAddress.countryCode']}
          >
            <Input
              name="countryCode"
              maxLength={2}
              value={values.countryCode}
              onChange={(event) =>
                setValues({ ...values, countryCode: event.target.value.toUpperCase() })
              }
              required
            />
          </FormField>
        </div>
        <div className="mt-4">
          <Checkbox name="saveAddress" label="Save this address for next time" />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text tone="muted" size="xs">
          Shipping is priced against this destination.
        </Text>
        <Button
          type="submit"
          size="lg"
          loading={pending || !hydrated}
          disabled={!hydrated}
        >
          Save address
        </Button>
      </div>
    </form>
  );
};
