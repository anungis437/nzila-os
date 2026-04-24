# Zonga Pilot KPIs

## KPI Focus

- events_created
- tickets_sold
- gross_ticket_revenue
- platform_fee_revenue
- attendee_checkins
- stream_starts
- stream_watch_minutes
- avg_watch_time
- creator_payouts
- replay_views
- event_conversion_rate
- repeat_attendee_rate

## Instrumentation Points

- Event creation action -> `events_created`
- Ticket purchase initiation -> `tickets_sold`, `gross_ticket_revenue`
- Stream playback grant (`/api/stream/[assetId]`) -> `stream_starts` (+ `replay_views` when replay mode)
- Analytics ingestion (`/api/analytics`) play events -> `stream_watch_minutes`, `avg_watch_time` (+ replay increment when flagged)
- Event check-in service -> `attendee_checkins`
- Revenue event recording path -> `gross_revenue`, `subscription_revenue`, `transaction_count`, `platform_fee_revenue` (when metadata includes fee)
- Payout execution path -> `creator_payouts`, `payout_volume`

All metric writes are routed through the Zonga pilot metrics adapter and enforce trace + actor/system identity at platform write time.

## Interpretation

- Traction: growth in events created, tickets sold, and stream starts.
- Monetization: gross/net/platform fee trends and transaction growth.
- Engagement quality: watch-time and repeat-attendee movement.
- Reliability concerns: dead-letter/retry increases and stream-start anomalies.
