/**
 * How the finished units travel.
 *
 * The accepted quote prices the goods; the courier is chosen by the buyer at
 * checkout, which is why this lives on the order and not in the frozen terms.
 */
export const SHIPPING_CHOICES = ['standard', 'express'] as const;
export type ShippingChoice = (typeof SHIPPING_CHOICES)[number];

/**
 * How long the courier takes once the units leave the factory.
 *
 * The quote prices the goods and gives a lead time for making them; it says
 * nothing about transit, so the platform owns these numbers and states them
 * openly wherever a delivery date is shown.
 */
export const TRANSIT_DAYS: Readonly<Record<ShippingChoice, number>> = Object.freeze({
  standard: 7,
  express: 3,
});

export interface OrderSchedule {
  /** When the funds were secured and the clock started. */
  readonly confirmedAt: Date;
  readonly estimatedShipAt: Date;
  readonly estimatedDeliveryAt: Date;
}

const addDays = (from: Date, days: number): Date =>
  new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

/**
 * The dates the order header shows.
 *
 * Everything is derived from one fact — the moment the funds were secured —
 * plus the quoted lead time and the chosen courier, so a shown date can always
 * be traced back to something both sides agreed to. Delay accepted with a
 * substitute part pushes both dates out by the same number of days.
 */
export const orderSchedule = (input: {
  readonly confirmedAt: Date;
  readonly leadTimeDays: number;
  readonly shippingChoice: ShippingChoice;
  readonly extraLeadTimeDays?: number;
}): OrderSchedule => {
  const lead = input.leadTimeDays + (input.extraLeadTimeDays ?? 0);
  const estimatedShipAt = addDays(input.confirmedAt, lead);
  return {
    confirmedAt: input.confirmedAt,
    estimatedShipAt,
    estimatedDeliveryAt: addDays(estimatedShipAt, TRANSIT_DAYS[input.shippingChoice]),
  };
};
