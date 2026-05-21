# Stripe webhook listener for ICRA report tier fulfillment
# Forwards checkout.session.completed (and all Stripe events) to union-eyes Next.js dev server

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  ICRA Stripe Webhook Listener (union-eyes)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Forwarding Stripe events to: http://localhost:3000/api/payments/webhooks/stripe" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT — on first run, copy the webhook signing secret shown below." -ForegroundColor Yellow
Write-Host "           Add it to apps/union-eyes/.env.local as:" -ForegroundColor Yellow
Write-Host "           STRIPE_WEBHOOK_SECRET=whsec_..." -ForegroundColor Gray
Write-Host ""
Write-Host "Test a checkout completion with:" -ForegroundColor Cyan
Write-Host "  stripe trigger checkout.session.completed" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

stripe listen `
  --events checkout.session.completed,payment_intent.succeeded,invoice.paid,invoice.payment_failed,charge.refunded `
  --forward-to localhost:3000/api/payments/webhooks/stripe

Write-Host ""
Write-Host "Webhook listener stopped." -ForegroundColor Yellow
