"use client";

import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const features = [
  {
    icon: "📋",
    title: "Smart Quoting Engine",
    description:
      "Create tiered proposals (Budget / Standard / Premium) with automatic tax calculations, margin tracking, and configurable floor gates per org.",
    bullets: ["Multi-tier proposals", "Auto tax calc", "Margin floor gates"],
  },
  {
    icon: "🔄",
    title: "Order Lifecycle Management",
    description:
      "State-machine-enforced workflows drive every order from creation through confirmation, production, shipment, and delivery with zero illegal transitions.",
    bullets: ["14-transition state machine", "Status enforcement", "Full audit trail"],
  },
  {
    icon: "💰",
    title: "Payment Deposit Gating",
    description:
      "Canonical payment gates block production, PO generation, and shipping until deposit thresholds are met — no revenue leakage.",
    bullets: ["Deposit threshold gates", "3-stage verification", "Revenue protection"],
  },
  {
    icon: "🏭",
    title: "Production & PO Tracking",
    description:
      "Order-centric production gating with purchase order workflows, supplier management, and QC checkpoints from proof to ship-ready.",
    bullets: ["PO state machine", "Supplier management", "QC loop integration"],
  },
  {
    icon: "🚚",
    title: "Shipment & Fulfillment",
    description:
      "Track shipments through packing, dispatch, in-transit, and delivery with carrier integration and real-time status updates.",
    bullets: ["8-transition tracking", "Carrier integration", "Delivery confirmation"],
  },
  {
    icon: "📊",
    title: "Domain Events & Analytics",
    description:
      "Every business action emits a domain event — persisted, queryable, and auditable. Real-time metrics for order pipelines and operational health.",
    bullets: ["Event persistence", "Pipeline metrics", "Operational dashboards"],
  },
];

export default function AnimatedFeatures() {
  return (
    <>
      <motion.div
        className="mb-16 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <span className="mb-4 inline-block rounded-full bg-electric/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-electric">
          Capabilities
        </span>
        <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
          The Complete Commerce Engine
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          From first quote to final delivery — every workflow enforced, every payment verified, every event tracked
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {features.map((feature) => (
          <motion.div key={feature.title} variants={itemVariants}>
            <div className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-electric/20">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10 text-2xl">
                {feature.icon}
              </div>
              <h3 className="font-poppins text-lg font-semibold text-navy">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {feature.description}
              </p>
              <ul className="mt-4 space-y-2">
                {feature.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-electric" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </>
  );
}
