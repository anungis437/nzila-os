"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function AnimatedCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-3xl glass-card rounded-2xl p-8 text-center md:p-12"
    >
      <h3 className="font-poppins text-2xl font-bold text-white md:text-3xl">
        Ready to Streamline Your Trade Operations?
      </h3>
      <p className="mx-auto mb-8 mt-4 max-w-xl text-lg text-white/80">
        Join businesses using Flow to manage quotes, orders, production, and
        shipments — with every step enforced and auditable.
      </p>

      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-xl bg-electric px-8 py-4 font-poppins font-bold text-white shadow-lg shadow-electric/30 transition-all hover:bg-blue-700"
          >
            Get Started Free
          </Link>
        </motion.div>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-8 py-4 font-poppins font-bold text-white backdrop-blur transition-all hover:bg-white/20"
          >
            Sign In
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
