"use client";

import { motion } from "framer-motion";
import { Inbox, Briefcase, AlertTriangle, Brain, BarChart3, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: Inbox,
    name: "Inbox",
    description: "Capture everything that comes in.",
  },
  {
    icon: Briefcase,
    name: "Work",
    description: "Manage cases and operations.",
  },
  {
    icon: AlertTriangle,
    name: "Priorities",
    description: "Focus on what matters now.",
  },
  {
    icon: Brain,
    name: "Intelligence",
    description: "Understand what it means.",
  },
  {
    icon: BarChart3,
    name: "Outcomes",
    description: "See what worked.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function WorkflowSection() {
  return (
    <>
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
          One System. One Workflow.
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
          From intake to outcome
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Not a collection of tools — a single workflow that moves every case forward.
        </p>
      </motion.div>

      <motion.div
        className="flex flex-col md:flex-row items-stretch justify-center gap-4 md:gap-0"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {steps.map((step, i) => (
          <motion.div key={step.name} variants={itemVariants} className="flex items-center">
            <div className="flex flex-col items-center text-center px-6 py-8 md:py-6 flex-1 min-w-0">
              <div className="bg-navy/5 p-4 rounded-2xl mb-4">
                <step.icon className="h-7 w-7 text-navy" />
              </div>
              <h3 className="text-lg font-bold text-navy mb-1">{step.name}</h3>
              <p className="text-sm text-gray-600 max-w-[180px]">{step.description}</p>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="hidden md:block h-5 w-5 text-gray-300 shrink-0" />
            )}
          </motion.div>
        ))}
      </motion.div>
    </>
  );
}
