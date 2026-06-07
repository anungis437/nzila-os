/**
 * PPE Distribution Tracker Component
 * 
 * Tracks personal protective equipment inventory and distribution with:
 * - Current inventory levels
 * - Low stock alerts
 * - Distribution history
 * - Employee PPE records
 * - Reorder recommendations
 * 
 * @module components/health-safety/PPEDistributionTracker
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  Search,
  Plus,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PPEItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  reorderPoint: number;
  unit: string;
  lastRestocked?: Date;
  distributedThisMonth: number;
}

export interface PPEDistributionTrackerProps {
  organizationId: string;
  onDistribute?: () => void;
  onReorder?: (itemId: string) => void;
}

export function PPEDistributionTracker({
  organizationId,
  onDistribute,
  onReorder
}: PPEDistributionTrackerProps) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<PPEItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    loadInventory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function loadInventory() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/health-safety/ppe/inventory?organizationId=${organizationId}`
      );

      if (!response.ok) {
        throw new Error("Failed to load PPE inventory");
      }

      const data = await response.json();
      if (data.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setItems(data.items.map((item: any) => ({
          ...item,
          lastRestocked: item.lastRestocked ? new Date(item.lastRestocked) : undefined
        })));
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load PPE inventory",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockItems = items.filter(item => item.currentStock <= item.reorderPoint);
  const criticalStockItems = items.filter(item => item.currentStock <= item.minimumStock);

  function getStockStatus(item: PPEItem) {
    if (item.currentStock <= item.minimumStock) {
      return { status: "critical", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/30" };
    }
    if (item.currentStock <= item.reorderPoint) {
      return { status: "low", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/30" };
    }
    return { status: "good", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/30" };
  }

  function getStockPercentage(item: PPEItem) {
    const maxStock = item.reorderPoint * 2; // Assume max is double reorder point
    return Math.min((item.currentStock / maxStock) * 100, 100);
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {criticalStockItems.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Critical Stock Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
              {criticalStockItems.length} item{criticalStockItems.length !== 1 ? 's' : ''} at critical stock levels
            </p>
            <div className="flex flex-wrap gap-2">
              {criticalStockItems.map(item => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="destructive"
                  onClick={() => onReorder?.(item.id)}
                >
                  <ShoppingCart className="h-3 w-3 mr-2" />
                  Reorder {item.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-xs text-muted-foreground">PPE types tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Critical Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalStockItems.length}</div>
            <p className="text-xs text-muted-foreground">Urgent reorder needed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {items.reduce((sum, item) => sum + item.distributedThisMonth, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Items distributed</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                PPE Inventory
              </CardTitle>
              <CardDescription>
                Track and manage protective equipment
              </CardDescription>
            </div>
            {onDistribute && (
              <Button size="sm" onClick={onDistribute}>
                <Plus className="h-4 w-4 mr-2" />
                Record Distribution
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PPE items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No PPE items found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Stock Level</TableHead>
                    <TableHead>Distributed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const status = getStockStatus(item);
                    const percentage = getStockPercentage(item);

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>
                          <span className={cn("font-semibold", status.color)}>
                            {item.currentStock}
                          </span>
                          {" "}{item.unit}
                        </TableCell>
                        <TableCell className="min-w-[150px]">
                          <div className="space-y-1">
                            <Progress value={percentage} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                              Min: {item.minimumStock} | Reorder: {item.reorderPoint}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{item.distributedThisMonth}</TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              status.status === "critical" && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                              status.status === "low" && "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
                              status.status === "good" && "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                            )}
                          >
                            {status.status === "critical" && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {status.status === "low" && <TrendingDown className="h-3 w-3 mr-1" />}
                            {status.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {(status.status === "critical" || status.status === "low") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onReorder?.(item.id)}
                            >
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              Reorder
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
