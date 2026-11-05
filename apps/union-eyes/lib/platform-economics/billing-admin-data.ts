/**
 * What the billing administration dashboard reads: every organization's subscriptions, invoices and payments.
 *
 * Cross-organization by design, so it runs on the system role (withSystemContext). That is only sound after a platform-level decision, and
 * the decision belongs to the caller: the dashboard page admits the platform billing roles (billing_specialist and above) before it
 * calls this. The statements are the billing service's own cross-organization queries (getAdmin*), run on the system transaction; before this they
 * ran on the module-level handle with no organization set, so the runtime role saw no organization's billing at all.
 *
 * The system role needs SELECT on org_subscriptions, platform_invoices, platform_payments, organizations and subscription_plans.
 */
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getAdminInvoices, getAdminPayments, getAdminSubscriptions } from '@/services/platform-economics/billing-service';

export async function loadBillingAdminData() {
  return withSystemContext(async () => {
    const subscriptions = await getAdminSubscriptions();
    const invoices = await getAdminInvoices();
    const payments = await getAdminPayments();
    return { subscriptions, invoices, payments };
  });
}
