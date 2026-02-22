"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";

/**
 * Premium CTA block — designed to sit inside a dark (navy) section.
 * Uses glass-card styling instead of shadcn Card for consistency
 * with the Nzila design system.
 */
export default function AnimatedCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass-card rounded-2xl p-8 md:p-12 text-center max-w-3xl mx-auto"
    >
      <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
        Ready to Transform Your Union?
      </h3>
      <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
        Join progressive unions using UnionEyes to better serve their members.
        Start your pilot in under 48 hours.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Button
            size="lg"
            className="rounded-xl bg-electric hover:bg-electric/90 text-white px-8 shadow-lg shadow-electric/25"
            asChild
          >
            <Link href="/pilot-request">Request a Pilot</Link>
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Button
            variant="outline"
            size="lg"
            className="rounded-xl border-white/30 text-white hover:bg-white/10 px-8"
            asChild
          >
            <Link href="/contact">Contact Sales</Link>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
} 
