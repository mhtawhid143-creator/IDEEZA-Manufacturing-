-- Database-level guards.
--
-- The domain layer (packages/domain) is the authority on business rules. The
-- constraints below are the subset that can be expressed exactly in SQL, added
-- so that a bug in any application path cannot leave an impossible record
-- behind. Nothing here re-implements a state machine; each one is a statement
-- about a single row.

-- ---------------------------------------------------------------------------
-- 1. An order may only exist without a payment while it has never been funded.
--    Any other status requires the payment to be attached.
-- ---------------------------------------------------------------------------
ALTER TABLE "ManufacturingOrder"
  ADD CONSTRAINT "order_needs_payment_once_past_awaiting"
  CHECK (
    "status" IN ('awaiting_payment', 'cancel_requested', 'cancelled')
    OR "paymentId" IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 2. One accepted quote per request.
--    "acceptedForRfqId" is unique, so the pointer can only be claimed once. The
--    two checks keep the pointer honest: it must name the request the quote
--    belongs to, and it must be present exactly when the quote is accepted.
-- ---------------------------------------------------------------------------
ALTER TABLE "Quote"
  ADD CONSTRAINT "quote_accepted_pointer_matches_rfq"
  CHECK ("acceptedForRfqId" IS NULL OR "acceptedForRfqId" = "rfqId");

ALTER TABLE "Quote"
  ADD CONSTRAINT "quote_accepted_pointer_set_iff_accepted"
  CHECK (("status" = 'accepted') = ("acceptedForRfqId" IS NOT NULL));

-- ---------------------------------------------------------------------------
-- 3. Messaging is context bound: a thread without its business object is not
--    representable.
-- ---------------------------------------------------------------------------
ALTER TABLE "MessageThread"
  ADD CONSTRAINT "thread_context_present"
  CHECK (
    ("contextKind" = 'rfq' AND "rfqId" IS NOT NULL)
    OR ("contextKind" = 'quote' AND "quoteId" IS NOT NULL)
    OR ("contextKind" IN ('order', 'shipping') AND "orderId" IS NOT NULL)
    OR ("contextKind" = 'dispute' AND "disputeId" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 4. Evidence belongs to exactly one context, and that context must be the one
--    the row claims.
-- ---------------------------------------------------------------------------
ALTER TABLE "Evidence"
  ADD CONSTRAINT "evidence_single_context"
  CHECK (
    (
      ("rfqId" IS NOT NULL)::int
      + ("quoteId" IS NOT NULL)::int
      + ("orderId" IS NOT NULL)::int
      + ("productionStageId" IS NOT NULL)::int
      + ("refundId" IS NOT NULL)::int
      + ("disputeId" IS NOT NULL)::int
    ) = 1
  );

ALTER TABLE "Evidence"
  ADD CONSTRAINT "evidence_context_matches_kind"
  CHECK (
    ("contextKind" = 'rfq' AND "rfqId" IS NOT NULL)
    OR ("contextKind" = 'quote' AND "quoteId" IS NOT NULL)
    OR ("contextKind" IN ('order', 'delivery') AND "orderId" IS NOT NULL)
    OR ("contextKind" = 'production' AND "productionStageId" IS NOT NULL)
    OR ("contextKind" = 'refund' AND "refundId" IS NOT NULL)
    OR ("contextKind" = 'dispute' AND "disputeId" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 5. The ten canonical production stages keep their business order. A stage row
--    cannot claim a position that belongs to another stage, so the buyer and the
--    manufacturer can never see a different lifecycle.
-- ---------------------------------------------------------------------------
ALTER TABLE "ProductionStage"
  ADD CONSTRAINT "stage_position_matches_canonical_key"
  CHECK (
    ("key" = 'quote_accepted' AND "position" = 1)
    OR ("key" = 'payment_secured' AND "position" = 2)
    OR ("key" = 'files_under_review' AND "position" = 3)
    OR ("key" = 'materials_confirmed' AND "position" = 4)
    OR ("key" = 'in_production' AND "position" = 5)
    OR ("key" = 'quality_check' AND "position" = 6)
    OR ("key" = 'ready_to_ship' AND "position" = 7)
    OR ("key" = 'shipped' AND "position" = 8)
    OR ("key" = 'delivered' AND "position" = 9)
    OR ("key" = 'completed' AND "position" = 10)
  );

-- ---------------------------------------------------------------------------
-- 6. Money integrity. Amounts are integer minor units; none of them may be
--    negative, and every currency column is a three letter uppercase code.
--    The payout arithmetic is checked because it is internal to the row.
--    The buyer-side fee model is still an open product decision, so no
--    relationship between the payment columns is assumed here.
-- ---------------------------------------------------------------------------
ALTER TABLE "Rfq"
  ADD CONSTRAINT "rfq_money_sane"
  CHECK (COALESCE("targetPriceMinor", 0) >= 0 AND "currency" ~ '^[A-Z]{3}$');

ALTER TABLE "Quote"
  ADD CONSTRAINT "quote_money_sane"
  CHECK (
    "unitPriceMinor" >= 0
    AND "totalPriceMinor" >= 0
    AND COALESCE("shippingEstimateMinor", 0) >= 0
    AND COALESCE("toolingSetupCostMinor", 0) >= 0
    AND "currency" ~ '^[A-Z]{3}$'
  );

ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "quote_item_money_sane"
  CHECK ("unitPriceMinor" >= 0 AND "lineTotalMinor" >= 0 AND "currency" ~ '^[A-Z]{3}$');

ALTER TABLE "AcceptedQuoteSnapshot"
  ADD CONSTRAINT "snapshot_money_sane"
  CHECK (
    "unitPriceMinor" >= 0
    AND "totalPriceMinor" >= 0
    AND COALESCE("shippingEstimateMinor", 0) >= 0
    AND COALESCE("toolingSetupCostMinor", 0) >= 0
    AND "currency" ~ '^[A-Z]{3}$'
  );

ALTER TABLE "Payment"
  ADD CONSTRAINT "payment_money_sane"
  CHECK (
    "goodsAmountMinor" >= 0
    AND "shippingAmountMinor" >= 0
    AND "taxAmountMinor" >= 0
    AND "platformFeeMinor" >= 0
    AND "totalChargedMinor" >= 0
    AND "currency" ~ '^[A-Z]{3}$'
  );

ALTER TABLE "Payout"
  ADD CONSTRAINT "payout_money_sane"
  CHECK (
    "orderAmountMinor" >= 0
    AND "platformFeeMinor" >= 0
    AND "netAmountMinor" >= 0
    AND "netAmountMinor" = "orderAmountMinor" - "platformFeeMinor"
    AND "currency" ~ '^[A-Z]{3}$'
  );

ALTER TABLE "WithdrawalRequest"
  ADD CONSTRAINT "withdrawal_money_sane"
  CHECK ("amountMinor" >= 0 AND "currency" ~ '^[A-Z]{3}$');

ALTER TABLE "Refund"
  ADD CONSTRAINT "refund_money_sane"
  CHECK (
    "requestedAmountMinor" >= 0
    AND COALESCE("approvedAmountMinor", 0) >= 0
    AND "currency" ~ '^[A-Z]{3}$'
  );

ALTER TABLE "Dispute"
  ADD CONSTRAINT "dispute_money_sane"
  CHECK (
    "claimedAmountMinor" >= 0
    AND COALESCE("outcomeAmountMinor", 0) >= 0
    AND "currency" ~ '^[A-Z]{3}$'
  );

ALTER TABLE "Substitution"
  ADD CONSTRAINT "substitution_currency_sane"
  CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "inventory_money_and_stock_sane"
  CHECK (
    "unitCostMinor" >= 0
    AND "stockQuantity" >= 0
    AND "reservedQuantity" >= 0
    AND "lowStockThreshold" >= 0
    AND "currency" ~ '^[A-Z]{3}$'
  );

-- ---------------------------------------------------------------------------
-- 7. Quantities and ratings.
-- ---------------------------------------------------------------------------
ALTER TABLE "Rfq" ADD CONSTRAINT "rfq_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "RfqItem" ADD CONSTRAINT "rfq_item_quantity_positive" CHECK ("quantityRequired" > 0);
ALTER TABLE "Quote" ADD CONSTRAINT "quote_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Quote" ADD CONSTRAINT "quote_lead_time_positive" CHECK ("leadTimeDays" > 0);
ALTER TABLE "Review" ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- ---------------------------------------------------------------------------
-- 8. Append-only records.
--    The event log and the accepted quote snapshot are the evidence base for
--    payout release and dispute decisions, so the database refuses to let them
--    be edited or removed row by row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ideeza_reject_row_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'append_only_violation: rows in % may not be changed (attempted %)',
    TG_TABLE_NAME, lower(TG_OP)
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DomainEvent_reject_update"
  BEFORE UPDATE ON "DomainEvent"
  FOR EACH ROW EXECUTE FUNCTION ideeza_reject_row_mutation();

CREATE TRIGGER "DomainEvent_reject_delete"
  BEFORE DELETE ON "DomainEvent"
  FOR EACH ROW EXECUTE FUNCTION ideeza_reject_row_mutation();

CREATE TRIGGER "AcceptedQuoteSnapshot_reject_update"
  BEFORE UPDATE ON "AcceptedQuoteSnapshot"
  FOR EACH ROW EXECUTE FUNCTION ideeza_reject_row_mutation();

CREATE TRIGGER "AcceptedQuoteSnapshot_reject_delete"
  BEFORE DELETE ON "AcceptedQuoteSnapshot"
  FOR EACH ROW EXECUTE FUNCTION ideeza_reject_row_mutation();
