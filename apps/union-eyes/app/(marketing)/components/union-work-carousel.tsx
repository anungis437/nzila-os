"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type WorkSlide = {
  title: string;
  subtitle: string;
  image: string;
  alt: string;
};

const slides: WorkSlide[] = [
  {
    title: "Grievance Intake Review",
    subtitle: "Steward triage and evidence tracking in one shared queue",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=800&fit=crop&q=80",
    alt: "Union representatives reviewing case intake items",
  },
  {
    title: "Bargaining Preparation",
    subtitle: "Clause intelligence and negotiation prep before bargaining rounds",
    image:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&h=800&fit=crop&q=80",
    alt: "Labour team planning negotiations in a boardroom",
  },
  {
    title: "Member Services Ops",
    subtitle: "Case updates, timelines, and communication in one workflow",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=800&fit=crop&q=80",
    alt: "Union support staff collaborating on member service operations",
  },
  {
    title: "Leadership Briefing",
    subtitle: "Live priorities and defensible reporting for executive decisions",
    image:
      "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=1200&h=800&fit=crop&q=80",
    alt: "Leadership team reviewing strategy and case outcomes",
  },
];

export default function UnionWorkCarousel() {
  const [active, setActive] = useState(0);
  const count = slides.length;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % count);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [count]);

  const current = useMemo(() => slides[active], [active]);

  return (
    <div className="space-y-5">
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
        <div className="relative aspect-video">
          <Image
            src={current.image}
            alt={current.alt}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 1000px"
          />
          <div className="absolute inset-0 bg-linear-to-t from-navy/75 via-navy/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
            <p className="text-sm md:text-base font-semibold text-white/85 uppercase tracking-wider">
              Union Work Snapshot
            </p>
            <h3 className="mt-2 text-2xl md:text-3xl font-bold text-white">
              {current.title}
            </h3>
            <p className="mt-1 text-white/85 text-sm md:text-base max-w-3xl">
              {current.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {slides.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => setActive(index)}
            className={`text-left rounded-xl border px-3 py-3 transition-colors ${
              active === index
                ? "border-electric bg-electric/10"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
            aria-label={`Show slide ${index + 1}: ${slide.title}`}
          >
            <div className="text-sm font-semibold text-navy line-clamp-1">{slide.title}</div>
            <div className="text-xs text-gray-600 mt-1 line-clamp-2">{slide.subtitle}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
