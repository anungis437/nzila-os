/**
 * Shopify Integration Service
 * 
 * Provides integration with Shop Moi Ça (Shopify) for redemption fulfillment.
 * 
 * Key Responsibilities:
 * - Look up a product via the Storefront API
 * - Create discount codes via Admin API
 * - Generate checkout URLs with pre-applied discounts
 * 
 * Architecture:
 * - Uses Shopify Storefront API (GraphQL) for public catalog access
 * - Uses Shopify Admin API (REST) for discount code creation
 * - Discount codes follow pattern: UE{redemption_id}
 * - Makes HTTP calls only; it reads no database table, so callers keep it outside their transactions
 * 
 * @see docs/recognition/api-contracts.md
 */

import { logger } from '@/lib/logger';
import { discountCodeFor } from './shopify-redemption-rules';

// Shopify configuration
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'shop-moi-ca.myshopify.com';
const SHOPIFY_STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN || '';
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || '';

// API endpoints
const STOREFRONT_API_URL = `https://${SHOPIFY_SHOP_DOMAIN}/api/2024-01/graphql.json`;
const ADMIN_API_URL = `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01`;

/**
 * Product from Shopify catalog
 */
export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  images: Array<{
    url: string;
    altText?: string;
  }>;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
    maxVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  variants: Array<{
    id: string;
    title: string;
    price: {
      amount: string;
      currencyCode: string;
    };
    availableForSale: boolean;
  }>;
}

/**
 * Discount code creation result
 */
export interface DiscountCodeResult {
  code: string;
  discountId: string;
  amount: number;
  currency: string;
}

/**
 * Checkout session
 */
export interface CheckoutSession {
  checkoutUrl: string;
  discountCode: string;
}

interface ShopifyEdge<TNode> {
  node: TNode;
}

interface ShopifyImageNode {
  url: string;
  altText?: string | null;
}

interface ShopifyVariantNode {
  id: string;
  title: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  availableForSale: boolean;
}

interface ShopifyProductNode {
  id: string;
  title: string;
  description: string;
  handle: string;
  images: { edges: ShopifyEdge<ShopifyImageNode>[] };
  priceRange: ShopifyProduct['priceRange'];
  variants: { edges: ShopifyEdge<ShopifyVariantNode>[] };
}

interface StorefrontProductResponse {
  data?: {
    productByHandle?: ShopifyProductNode | null;
  };
}

interface ShopifyPriceRule {
  id: string;
}

interface ShopifyDiscountCode {
  id: string;
}

interface ShopifyPriceRuleResponse {
  price_rule?: ShopifyPriceRule;
}

interface ShopifyDiscountCodeResponse {
  discount_code?: ShopifyDiscountCode;
}

/** What the Shopify Admin API's shop.json says about the shop; the admin page shows the name and the domain. */
export interface ShopifyShop {
  name: string;
  domain: string;
}

interface ShopifyShopResponse {
  shop?: { name?: unknown; domain?: unknown };
}

/**
 * Create a discount code for redemption
 * 
 * Generates a unique discount code in Shopify Admin API.
 * Code format: UE{redemption_id} (UnionEyes + redemption ID).
 * 
 * @param redemptionId - Redemption record ID
 * @param amount - Discount amount in CAD (e.g., 50.00)
 * @param currency - Currency code (default: CAD)
 * @returns Discount code details
 */
export async function createDiscountCode(
  redemptionId: string,
  amount: number,
  currency: string = 'CAD'
): Promise<DiscountCodeResult> {
  try {
    // The webhook resolves the redemption from this code, so it is defined with its parser in shopify-redemption-rules.
    const code = discountCodeFor(redemptionId);

    // Create price rule first (discount amount)
    const priceRule = await createPriceRule(amount, currency, code);

    // Then create discount code linked to price rule
    const discountCode = await createDiscountCodeForPriceRule(priceRule.id, code);

    return {
      code,
      discountId: discountCode.id,
      amount,
      currency,
    };
  } catch (error) {
    logger.error('[Shopify] Error creating discount code', { error, redemptionId });
    throw new Error('Failed to create discount code');
  }
}

/**
 * Create a price rule in Shopify
 * 
 * Price rules define the discount amount and conditions.
 * 
 * @param amount - Discount amount
 * @param currency - Currency code
 * @param title - Price rule title
 * @returns Price rule object
 */
async function createPriceRule(
  amount: number,
  currency: string,
  title: string
): Promise<ShopifyPriceRule> {
  const response = await fetch(`${ADMIN_API_URL}/price_rules.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({
      price_rule: {
        title: `UnionEyes Redemption - ${title}`,
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        value_type: 'fixed_amount',
        value: `-${amount}`,
        customer_selection: 'all',
        once_per_customer: true,
        usage_limit: 1,
        starts_at: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[Shopify] Price rule creation error', { error });
    throw new Error('Failed to create price rule');
  }

  const result = (await response.json()) as ShopifyPriceRuleResponse;

  if (!result.price_rule) {
    throw new Error('Shopify response missing price_rule');
  }

  return result.price_rule;
}

/**
 * Create a discount code for a price rule
 * 
 * @param priceRuleId - Price rule ID
 * @param code - Discount code string
 * @returns Discount code object
 */
async function createDiscountCodeForPriceRule(
  priceRuleId: string,
  code: string
): Promise<ShopifyDiscountCode> {
  const response = await fetch(
    `${ADMIN_API_URL}/price_rules/${priceRuleId}/discount_codes.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
      },
      body: JSON.stringify({
        discount_code: {
          code,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error('[Shopify] Discount code creation error', { error, priceRuleId });
    throw new Error('Failed to create discount code');
  }

  const result = (await response.json()) as ShopifyDiscountCodeResponse;

  if (!result.discount_code) {
    throw new Error('Shopify response missing discount_code');
  }

  return result.discount_code;
}

/**
 * Generate checkout URL with pre-applied discount
 * 
 * Creates a Shopify checkout URL with the discount code automatically applied.
 * Members can proceed to checkout without manually entering the code.
 * 
 * @param discountCode - Discount code to apply
 * @param variantIds - Optional: Pre-populate cart with variant IDs
 * @returns Checkout session with URL
 */
export async function createCheckoutSession(
  discountCode: string,
  variantIds?: Array<{ id: string; quantity: number }>
): Promise<CheckoutSession> {
  try {
    // Build checkout URL
    let checkoutUrl = `https://${SHOPIFY_SHOP_DOMAIN}/cart`;

    // Add items to cart if provided
    if (variantIds && variantIds.length > 0) {
      const cartItems = variantIds
        .map((item) => {
          // Extract numeric ID from Shopify GID
          const numericId = item.id.split('/').pop();
          return `${numericId}:${item.quantity}`;
        })
        .join(',');

      checkoutUrl = `https://${SHOPIFY_SHOP_DOMAIN}/cart/${cartItems}`;
    }

    // Append discount code
    checkoutUrl += `?discount=${encodeURIComponent(discountCode)}`;

    return {
      checkoutUrl,
      discountCode,
    };
  } catch (error) {
    logger.error('[Shopify] Error creating checkout session', { error, discountCode });
    throw new Error('Failed to create checkout session');
  }
}

/**
 * Whether an address is a checkout on the configured store: the one place a member is sent after their credits were spent. The checkout URL
 * is built from the configured shop domain, and this is the check that keeps it so for whoever passes it on.
 */
export function isStoreCheckoutUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && url.hostname === SHOPIFY_SHOP_DOMAIN;
  } catch {
    return false;
  }
}

/**
 * Test Shopify connection
 * 
 * Verifies that Shopify credentials are valid by fetching shop info.
 * 
 * @returns Shop information or null if connection fails
 */
export async function testShopifyConnection(): Promise<ShopifyShop | null> {
  try {
    const response = await fetch(`${ADMIN_API_URL}/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
      },
    });

    if (!response.ok) {
      logger.error('[Shopify] Connection test failed', { statusText: response.statusText });
      return null;
    }

    const result = (await response.json()) as ShopifyShopResponse;
    const { shop } = result;
    // A connection is confirmed by a shop that names itself, not by any answer.
    if (shop && typeof shop.name === 'string' && typeof shop.domain === 'string') return { name: shop.name, domain: shop.domain };
    logger.error('[Shopify] Connection test answered without a shop name and domain');
    return null;
  } catch (error) {
    logger.error('[Shopify] Connection error', { error });
    return null;
  }
}

/**
 * Get product by handle
 * 
 * Fetches a single product by its URL handle.
 * 
 * @param handle - Product handle
 * @returns Product or null if not found
 */
export async function getProductByHandle(
  handle: string
): Promise<ShopifyProduct | null> {
  const query = `
    query GetProduct($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        description
        handle
        images(first: 5) {
          edges {
            node {
              url
              altText
            }
          }
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 10) {
          edges {
            node {
              id
              title
              price {
                amount
                currencyCode
              }
              availableForSale
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(STOREFRONT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: { handle },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as StorefrontProductResponse;

    if (!result.data?.productByHandle) {
      return null;
    }

    const product = result.data.productByHandle;

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      handle: product.handle,
      images: product.images.edges.map((edge) => ({
        url: edge.node.url,
        altText: edge.node.altText ?? undefined,
      })),
      priceRange: product.priceRange,
      variants: product.variants.edges.map((edge) => ({
        id: edge.node.id,
        title: edge.node.title,
        price: edge.node.price,
        availableForSale: edge.node.availableForSale,
      })),
    };
  } catch (error) {
    logger.error('[Shopify] Error fetching product', { error, handle });
    return null;
  }
}

