/**
 * Shopify Integration Service
 * 
 * Provides integration with Shop Moi Ça (Shopify) for redemption fulfillment.
 * 
 * Key Responsibilities:
 * - Fetch curated product collections via Storefront API
 * - Create discount codes via Admin API
 * - Generate checkout URLs with pre-applied discounts
 * 
 * Architecture:
 * - Uses Shopify Storefront API (GraphQL) for public catalog access
 * - Uses Shopify Admin API (REST) for discount code creation
 * - Discount codes follow pattern: UE{redemption_id}
 * 
 * @see docs/recognition/api-contracts.md
 */

import { db } from '@/db';
import { shopifyConfig } from '@/db/schema/recognition-rewards-schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

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
 * Collection of products
 */
export interface ShopifyCollection {
  id: string;
  title: string;
  description: string;
  handle: string;
  products: ShopifyProduct[];
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

/**
 * Fetch curated product collections for redemption
 * 
 * Queries Shopify Storefront API to retrieve products from allowed collections.
 * Filters based on org-specific configuration if available.
 * 
 * @param orgId - Organization ID for collection filtering
 * @param limit - Maximum number of products per collection
 * @returns Array of collections with products
 */
export async function fetchCuratedCollections(
  orgId: string,
  limit: number = 20
): Promise<ShopifyCollection[]> {
  try {
    // Check if org has specific Shopify config
    const orgConfig = await db.query.shopifyConfig.findFirst({
      where: eq(shopifyConfig.orgId, orgId),
    });

    const allowedCollections = (orgConfig?.allowedCollections as string[] | null) || ['rewards'];

    // Fetch collections via Storefront API
    const collections: ShopifyCollection[] = [];

    for (const collectionHandle of allowedCollections) {
      const collection = await fetchCollectionByHandle(collectionHandle, limit);
      if (collection) {
        collections.push(collection);
      }
    }

    return collections;
  } catch (error) {
    logger.error('[Shopify] Error fetching collections', { error, orgId });
    throw new Error('Failed to fetch product catalog');
  }
}

/**
 * Fetch a single collection by handle
 * 
 * @param handle - Collection handle (URL-friendly name)
 * @param limit - Maximum number of products
 * @returns Collection with products or null if not found
 */
async function fetchCollectionByHandle(
  handle: string,
  limit: number
): Promise<ShopifyCollection | null> {
  const query = `
    query GetCollection($handle: String!, $limit: Int!) {
      collectionByHandle(handle: $handle) {
        id
        title
        description
        handle
        products(first: $limit) {
          edges {
            node {
              id
              title
              description
              handle
              images(first: 3) {
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
        }
      }
    }
  `;

  const response = await fetch(STOREFRONT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query,
      variables: { handle, limit },
    }),
  });

  if (!response.ok) {
    logger.error('[Shopify] Storefront API error', { statusText: response.statusText });
    return null;
  }

  const result = await response.json();

  if (!result.data?.collectionByHandle) {
    logger.warn('[Shopify] Collection not found', { handle });
    return null;
  }

  const collection = result.data.collectionByHandle;

  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    handle: collection.handle,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: collection.products.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      description: edge.node.description,
      handle: edge.node.handle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      images: edge.node.images.edges.map((imgEdge: any) => ({
        url: imgEdge.node.url,
        altText: imgEdge.node.altText,
      })),
      priceRange: edge.node.priceRange,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      variants: edge.node.variants.edges.map((variantEdge: any) => ({
        id: variantEdge.node.id,
        title: variantEdge.node.title,
        price: variantEdge.node.price,
        availableForSale: variantEdge.node.availableForSale,
      })),
    })),
  };
}

/**
 * Create a discount code for redemption
 * 
 * Generates a unique discount code in Shopify Admin API.
 * Code format: UE{redemption_id} (Union Eyes + redemption ID).
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
    const code = `UE${redemptionId.replace(/-/g, '').substring(0, 12).toUpperCase()}`;

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const response = await fetch(`${ADMIN_API_URL}/price_rules.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({
      price_rule: {
        title: `Union Eyes Redemption - ${title}`,
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

  const result = await response.json();
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
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

  const result = await response.json();
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
 * Test Shopify connection
 * 
 * Verifies that Shopify credentials are valid by fetching shop info.
 * 
 * @returns Shop information or null if connection fails
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function testShopifyConnection(): Promise<any | null> {
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

    const result = await response.json();
    return result.shop;
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

    const result = await response.json();

    if (!result.data?.productByHandle) {
      return null;
    }

    const product = result.data.productByHandle;

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      handle: product.handle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      images: product.images.edges.map((edge: any) => ({
        url: edge.node.url,
        altText: edge.node.altText,
      })),
      priceRange: product.priceRange,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      variants: product.variants.edges.map((edge: any) => ({
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

