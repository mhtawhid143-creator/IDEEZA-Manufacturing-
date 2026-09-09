-- When a shop first opened each part of what it is being asked to build.
--
-- A quote priced without reading the files, the specification or the bill of
-- materials is a price for work nobody looked at, and the dispute that follows
-- lands on money already secured. The quote form refuses to send until the
-- parts that apply have been opened; these columns are that record, kept per
-- shop and per request rather than per browser session so it survives a
-- reload and cannot be satisfied by someone else's reading.
ALTER TABLE "RfqRecipient" ADD COLUMN "filesViewedAt" TIMESTAMP(3);
ALTER TABLE "RfqRecipient" ADD COLUMN "specificationViewedAt" TIMESTAMP(3);
ALTER TABLE "RfqRecipient" ADD COLUMN "bomViewedAt" TIMESTAMP(3);
