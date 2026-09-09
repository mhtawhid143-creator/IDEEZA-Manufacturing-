-- An unavailable line names no substitute.
--
-- The status says the shop cannot cover the part; a suggested part on the same
-- row would contradict that, and the buyer would be reading two answers. The
-- constraint refuses the contradiction rather than leaving it to the writer.
ALTER TABLE "Substitution"
  ADD CONSTRAINT "substitution_unavailable_names_no_part"
  CHECK (
    "status" <> 'unavailable'
    OR ("suggestedInventoryItemId" IS NULL AND "suggestedPartName" = '')
  );

-- Nothing is owed to the buyer on a line the shop cannot cover, so its impact
-- is zero rather than a number carried over from a substitute that does not
-- exist.
ALTER TABLE "Substitution"
  ADD CONSTRAINT "substitution_unavailable_has_no_impact"
  CHECK (
    "status" <> 'unavailable'
    OR ("priceImpactMinor" = 0 AND "leadTimeImpactDays" = 0)
  );
