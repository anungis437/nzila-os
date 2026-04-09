"use client";

import { motion } from "framer-motion";
import { Users, Scale, Building2, Globe, Shield } from "lucide-react";

const roles = [
  {
    icon: Users,
    title: "For Representatives",
    description: "Handle cases faster and with clarity.",
    href: "/en-CA/for-representatives",
  },
  {
    icon: Scale,
    title: "For Leadership",
    description: "See what matters across your organization.",
    href: "/en-CA/for-leadership",
  },
  {
    icon: Building2,
    title: "For Federations",
    description: "Understand trends across locals.",
    href: "/en-CA/for-federations",
  },
  {
    icon: Globe,
    title: "For CLC",
    description: "Executive intelligence for labour strategy.",
    href: "/en-CA/for-clc",
  },
  {
    icon: Shield,
    title: "For Members",
    description: "Know where your case stands, always.",
    href: "/en-CA/for-members",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function RolesSection() {
  return (
    <>
      <motion.div
        className="text-center mb-14"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
          Built for every role in labour
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Whether you&apos;re filing a case or setting national strategy, the system adapts to how you work.
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {roles.map((role) => (
          <motion.a
            key={role.title}
            href={role.href}
            variants={itemVariants}
            className="group flex flex-col items-center text-center p-6 rounded-2xl border border-gray-100 bg-white hover:border-electric/30 hover:shadow-lg hover:shadow-electric/5 transition-all"
          >
            <div className="bg-electric/10 p-3 rounded-xl mb-4 group-hover:bg-electric/20 transition-colors">
              <role.icon className="h-6 w-6 text-electric" />
            </div>
            <h3 className="font-bold text-navy mb-1">{role.title}</h3>
            <p className="text-sm text-gray-600">{role.description}</p>
          </motion.a>
        ))}
      </motion.div>
    </>
  );
}
