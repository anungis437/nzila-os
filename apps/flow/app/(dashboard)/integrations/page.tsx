export const metadata = { title: "Integrations — Flow" };

const integrations = [
  {
    name: "Zoho CRM",
    description: "Bi-directional sync of contacts, deals, and leads.",
    status: "Connected",
    statusColor: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Zoho Books",
    description: "Push POs and invoices to Zoho Books.",
    status: "Connected",
    statusColor: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Zoho Inventory",
    description: "Real-time stock sync with Zoho Inventory.",
    status: "Connected",
    statusColor: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Shopify",
    description: "Customer and order sync via Admin API + webhooks.",
    status: "Connected",
    statusColor: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Canva",
    description: "Design proof creation from brand templates.",
    status: "Coming Soon",
    statusColor: "bg-gray-100 text-gray-500",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy">Integrations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage connected services, sync status, and webhook configurations.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((int) => (
          <div
            key={int.name}
            className="rounded-xl border border-gray-200 bg-white p-6"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-gray-900">{int.name}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${int.statusColor}`}
              >
                {int.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-500">{int.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-navy">
          Webhook Endpoints
        </h2>
        <div className="space-y-3">
          {[
            { path: "/api/zoho/webhook", method: "POST", auth: "Token" },
            { path: "/api/shopify/webhook", method: "POST", auth: "HMAC-SHA256" },
          ].map((wh) => (
            <div
              key={wh.path}
              className="flex items-center gap-4 rounded-lg bg-gray-50/60 px-4 py-3"
            >
              <span className="rounded bg-electric/10 px-2 py-0.5 text-xs font-mono font-medium text-electric">
                {wh.method}
              </span>
              <code className="flex-1 text-sm text-gray-700">{wh.path}</code>
              <span className="text-xs text-gray-400">{wh.auth}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
