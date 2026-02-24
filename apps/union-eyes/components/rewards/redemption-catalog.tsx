'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ShoppingCart, ChevronRight, Filter } from 'lucide-react';
import Image from 'next/image';

interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  imageUrl?: string;
  available: boolean;
  tags?: string[];
  vendor?: string;
}

interface RedemptionCatalogProps {
  products: Product[];
  userBalance: number;
  onRedeem: (productId: string, creditsToSpend: number) => void;
  loading?: boolean;
}

export function RedemptionCatalog({
  products,
  userBalance,
  onRedeem,
  loading = false,
}: RedemptionCatalogProps) {
  const t = useTranslations('rewards.catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(products.flatMap((p) => p.tags || [])))];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || 
      product.tags?.includes(selectedCategory);

    return matchesSearch && matchesCategory;
  });

  const canAfford = (price: number) => userBalance >= price;

  const getSavingsPercentage = (price: number, compareAt?: number) => {
    if (!compareAt || compareAt <= price) return null;
    return Math.round(((compareAt - price) / compareAt) * 100);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-48 w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="whitespace-nowrap"
            >
              {category === 'all' ? t('categories.all') : category}
            </Button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t('noProducts')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const affordable = canAfford(product.price);
            const savings = getSavingsPercentage(product.price, product.compareAtPrice);

            return (
              <Card 
                key={product.id} 
                className={`flex flex-col transition-shadow hover:shadow-lg ${
                  !affordable ? 'opacity-60' : ''
                }`}
              >
                <CardHeader className="p-0">
                  <div className="relative aspect-square overflow-hidden rounded-t-lg bg-muted">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ShoppingCart className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                    
                    {savings && (
                      <Badge 
                        className="absolute top-2 right-2 bg-red-500"
                      >
                        {savings}% OFF
                      </Badge>
                    )}
                    
                    {!product.available && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="secondary">{t('outOfStock')}</Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 p-4 space-y-2">
                  {product.vendor && (
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {product.vendor}
                    </p>
                  )}
                  
                  <h3 className="font-semibold line-clamp-2 min-h-[2.5rem]">
                    {product.title}
                  </h3>
                  
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  <div className="flex items-baseline gap-2 pt-2">
                    <span className="text-2xl font-bold text-primary">
                      {product.price}
                    </span>
                    <span className="text-sm text-muted-foreground">credits</span>
                    {product.compareAtPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        {product.compareAtPrice}
                      </span>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-0">
                  <Button
                    className="w-full gap-2"
                    onClick={() => onRedeem(product.id, product.price)}
                    disabled={!affordable || !product.available}
                  >
                    {!affordable ? (
                      t('insufficientCredits')
                    ) : !product.available ? (
                      t('outOfStock')
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        {t('redeem')}
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

