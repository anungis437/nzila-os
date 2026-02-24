// eslint-disable-next-line no-restricted-imports -- TODO(platform-migration): migrate to @nzila/ wrapper
import Stripe from "stripe";

// Validate Stripe secret key
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    'STRIPE_SECRET_KEY is not defined. Please add it to your environment variables.'
  );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  appInfo: {
    name: "UnionEyes",
    version: "1.0.0"
  },
  typescript: true,
});

