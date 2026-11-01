-- UE Gate 0 (DEF-0B8-ICRA-SHOPIFY-WEBHOOK-STORES-FULL-PAYLOAD-AND-CUSTOMER-DATA-IN-A-GLOBAL-TABLE): the Shopify webhook used to keep
-- the whole delivery in webhook_receipts.payload_json (a table with no organization column) and the purchaser's Shopify customer id,
-- e-mail address and name, and the line-item titles, in reward_redemptions.provider_payload_json. The receiver now keeps only which
-- event it was and what it referred to; this removes what was already stored. It is an intentionally irreversible privacy redaction;
-- do not restore purchaser data in a rollback.
-- Idempotent on PostgreSQL 15 and 16; requires migration-owner privileges.
DO $$
BEGIN
  IF to_regclass('webhook_receipts') IS NOT NULL THEN
    UPDATE webhook_receipts
    SET payload_json = jsonb_strip_nulls(jsonb_build_object(
          'topic', event_type,
          'order_id', coalesce(payload_json->>'order_id', CASE WHEN event_type LIKE 'orders/%' THEN payload_json->>'id' END),
          'refund_id', CASE WHEN event_type = 'refunds/create' THEN payload_json->>'id' END,
          'redacted', true
        ))
    WHERE provider = 'shopify'
      AND coalesce((payload_json->>'redacted')::boolean, false) = false;
  END IF;

  IF to_regclass('reward_redemptions') IS NOT NULL THEN
    UPDATE reward_redemptions
    SET provider_payload_json = (provider_payload_json - 'customer') ||
          CASE
            WHEN jsonb_typeof(provider_payload_json->'line_items') = 'array' THEN
              jsonb_build_object('line_items', (
                SELECT coalesce(jsonb_agg(item - 'title'), '[]'::jsonb)
                FROM jsonb_array_elements(provider_payload_json->'line_items') AS item
              ))
            ELSE '{}'::jsonb
          END
    WHERE jsonb_typeof(provider_payload_json) = 'object'
      AND (provider_payload_json ? 'customer' OR provider_payload_json->'line_items' @> '[{"title": null}]'::jsonb
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(provider_payload_json->'line_items') = 'array' THEN provider_payload_json->'line_items' ELSE '[]'::jsonb END
             ) AS item WHERE item ? 'title'));
  END IF;
END
$$;
