'use server';

import { DomainError, asId, type OrderId } from '@ideeza/domain';
import { confirmCheckoutSchema, payOrderSchema } from '@ideeza/types';
import { payOrder, readPromoForOrder, setCheckoutAddress } from '@/data/checkout.js';
import { requireBuyer } from '@/lib/auth.js';

const textOf = (value: FormDataEntryValue | null): string =>
  typeof value === 'string' ? value.trim() : '';

const optionalTextOf = (value: FormDataEntryValue | null): string | undefined => {
  const text = textOf(value);
  return text === '' ? undefined : text;
};

export interface PromoState {
  readonly code?: string;
  readonly usable?: boolean;
  readonly discountMinor?: number;
  readonly description?: string | null;
  readonly message?: string;
}

const PROMO_MESSAGE: Readonly<Record<string, string>> = {
  unknown: 'That code does not exist.',
  inactive: 'That code is no longer being offered.',
  not_started: 'That code is not live yet.',
  expired: 'That code has expired.',
  exhausted: 'That code has been used its maximum number of times.',
  below_minimum: 'This order is below the minimum spend for that code.',
  wrong_currency: 'That code is issued in another currency.',
};

/** Reads a coupon against the order, and says why when it cannot be used. */
export const readPromoAction = async (
  orderIdInput: string,
  code: string,
): Promise<PromoState> => {
  const actor = await requireBuyer(`/manufacturing/checkout/${orderIdInput}`);
  try {
    const result = await readPromoForOrder(actor.userId, asId<OrderId>(orderIdInput), code);
    if (!result.usable) {
      return {
        code,
        usable: false,
        message:
          result.refusal === undefined
            ? 'That code takes nothing off this order.'
            : (PROMO_MESSAGE[result.refusal] ?? 'That code cannot be used here.'),
      };
    }
    return {
      code: code.trim().toUpperCase(),
      usable: true,
      discountMinor: result.discountMinor,
      description: result.description,
    };
  } catch (error) {
    if (error instanceof DomainError) return { code, usable: false, message: error.message };
    if (error instanceof Error) return { code, usable: false, message: error.message };
    throw error;
  }
};

export interface AddressState {
  readonly saved?: boolean;
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

/** Changes where the order ships to, while it is still unpaid. */
export const setAddressAction = async (
  _previous: AddressState,
  form: FormData,
): Promise<AddressState> => {
  const orderId = textOf(form.get('orderId'));
  const actor = await requireBuyer(`/manufacturing/checkout/${orderId}/address`);

  const parsed = confirmCheckoutSchema.safeParse({
    orderId,
    shippingChoice: textOf(form.get('shippingChoice')) || 'standard',
    deliveryAddress: {
      line1: textOf(form.get('line1')),
      line2: optionalTextOf(form.get('line2')),
      city: textOf(form.get('city')),
      region: optionalTextOf(form.get('region')),
      postalCode: optionalTextOf(form.get('postalCode')),
      countryCode: textOf(form.get('countryCode')).toUpperCase(),
    },
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.filter((part) => typeof part === 'string').join('.');
      fieldErrors[field === '' ? 'form' : field] ??= issue.message;
    }
    return { error: 'That address is not complete.', fieldErrors };
  }

  try {
    await setCheckoutAddress(
      actor.userId,
      asId<OrderId>(orderId),
      parsed.data.deliveryAddress,
      textOf(form.get('saveAddress')) === 'on',
    );
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};

export interface PayState {
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  /** Where to go once the payment has been recorded, either way. */
  readonly redirectTo?: string;
}

/**
 * Pays the order, which is what confirms it.
 *
 * A refusal is reported back to the form; a recorded payment — secured or
 * failed — sends the buyer to the result screen, because both outcomes are
 * something that happened rather than a form error.
 */
export const payOrderAction = async (
  _previous: PayState,
  form: FormData,
): Promise<PayState> => {
  const orderId = textOf(form.get('orderId'));
  const actor = await requireBuyer(`/manufacturing/checkout/${orderId}/payment`);

  const parsed = payOrderSchema.safeParse({
    orderId,
    method: textOf(form.get('method')),
    shippingChoice: textOf(form.get('shippingChoice')) || 'standard',
    promoCode: optionalTextOf(form.get('promoCode')),
    cardName: optionalTextOf(form.get('cardName')),
    cardNumber: optionalTextOf(form.get('cardNumber')),
    cardExpiry: optionalTextOf(form.get('cardExpiry')),
    cardCvc: optionalTextOf(form.get('cardCvc')),
    walletAddress: optionalTextOf(form.get('walletAddress')),
    savedMethodId: optionalTextOf(form.get('savedMethodId')),
    acceptTerms: textOf(form.get('acceptTerms')) === 'on',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.filter((part) => typeof part === 'string').join('.');
      fieldErrors[field === '' ? 'form' : field] ??= issue.message;
    }
    return {
      error:
        fieldErrors['acceptTerms'] !== undefined
          ? 'Accept the terms to pay.'
          : 'Some of the payment details still need attention.',
      fieldErrors,
    };
  }

  try {
    const result = await payOrder(actor.userId, parsed.data);
    return {
      redirectTo: `/manufacturing/checkout/${orderId}/done?payment=${result.paymentId}`,
    };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};
