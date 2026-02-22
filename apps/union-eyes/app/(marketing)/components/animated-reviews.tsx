"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { User, Quote } from "lucide-react";

interface Review {
  name: string;
  title: string;
  content: string;
  rating: number;
  icon?: React.ReactNode;
}

interface AnimatedReviewsProps {
  /** Pass union-specific reviews — required, no default boilerplate. */
  reviews: Review[];
  /** Override section heading (default: "What Union Leaders Say") */
  heading?: string;
  /** Override section subtitle */
  subtitle?: string;
}

export default function AnimatedReviews({
  reviews,
  heading = "What Union Leaders Say",
  subtitle = "Trusted by stewards, reps, and executives across Canada's labour movement",
}: AnimatedReviewsProps) {
  // Duplicate to fill the infinite carousel
  const allReviews = [...reviews, ...reviews, ...reviews, ...reviews];

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">{heading}</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
      </motion.div>

      <div className="carousel-container py-4">
        <div className={`flex items-stretch gap-6 px-4 ${isVisible ? "animate-carousel" : ""}`}>
          {allReviews.map((review, index) => (
            <motion.div
              key={`review-${index}`}
              className="flex-none w-full sm:w-90 md:w-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.5 }}
            >
              <Card className="h-full flex flex-col shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border-t-4 border-t-primary/70">
                <CardHeader className="pb-2 relative">
                  <div className="absolute top-3 right-3 text-primary/20">
                    <Quote size={42} />
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-primary/10 p-2 rounded-full">
                      {review.icon || <User className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{review.name}</CardTitle>
                      <CardDescription>{review.title}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center pt-2">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className="w-4 h-4 text-yellow-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="grow pt-0">
                  <p className="text-foreground/90 italic leading-relaxed">&quot;{review.content}&quot;</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
} 
