"use client";

import { listFlowEngineModules } from "@nzila/flow-engine";
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

const modules = listFlowEngineModules();

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
          The Complete Commerce Product
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          From first quote to final delivery, Flow packages Flow Engine into the operating surface teams actually use.
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {modules.map((module) => (
          <motion.div key={module.id} variants={itemVariants}>
            <div className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-electric/20">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10 text-2xl">
                {module.icon}
              </div>
              <h3 className="font-poppins text-lg font-semibold text-navy">
                {module.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {module.description}
              </p>
              <ul className="mt-4 space-y-2">
                {module.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-electric" />
                    {bullet}
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
