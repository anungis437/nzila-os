-- Source artifact only; no environment migration is performed by this change.
-- Preserve legacy UUID rows without inferring ownership from a creator/profile
-- ID. New writes address the actual opaque canonical principal in a separate
-- text field. The two namespaces cannot contradict each other on one row.
BEGIN;

ALTER TABLE "zonga_notifications" ADD COLUMN "recipient_user_id" text;
ALTER TABLE "zonga_notifications" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "zonga_notifications"
  ADD CONSTRAINT "zonga_notification_recipient_namespace_ck"
  CHECK (
    ("recipient_user_id" IS NULL AND "user_id" IS NOT NULL)
    OR ("recipient_user_id" IS NOT NULL AND "user_id" IS NULL
      AND length(btrim("recipient_user_id")) > 0
      AND "recipient_user_id" = btrim("recipient_user_id"))
  ) NOT VALID;
ALTER TABLE "zonga_notifications"
  VALIDATE CONSTRAINT "zonga_notification_recipient_namespace_ck";

COMMIT;
