/**
 * Membership Card Viewer Component
 * 
 * Digital membership card display with:
 * - Front/back flip animation
 * - QR code for verification
 * - Printable version
 * - Download as PDF/image
 * - Wallet integration (Google/Apple)
 * 
 * @module components/members/membership-card-viewer
 */

"use client";

import * as React from "react";
import {
  Download,
  Printer,
  Smartphone,
  RotateCcw,
  QrCode,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface MembershipCardData {
  memberNumber: string;
  firstName: string;
  lastName: string;
  memberSince: Date;
  expiryDate: Date;
  chapter: string;
  status: "active" | "expired" | "suspended";
  photoUrl?: string;
  unionLogo?: string;
  cardBackgroundColor?: string;
}

export interface MembershipCardViewerProps {
  cardData: MembershipCardData;
  onDownload?: (format: "pdf" | "png") => void;
  onPrint?: () => void;
  onAddToWallet?: (type: "google" | "apple") => void;
}

export function MembershipCardViewer({
  cardData,
  onDownload,
  onPrint,
  onAddToWallet,
}: MembershipCardViewerProps) {
  const [isFlipped, setIsFlipped] = React.useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Digital Membership Card</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleFlip}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Flip Card
          </Button>
          {onPrint && (
            <Button size="sm" variant="outline" onClick={onPrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          )}
          {onDownload && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDownload("pdf")}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Card Container with flip animation */}
      <div className="perspective-1000">
        <div
          className={cn(
            "relative w-full aspect-[1.586/1] transition-transform duration-700 transform-style-3d",
            isFlipped && "rotate-y-180"
          )}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Front of Card */}
          <Card
            className={cn(
              "absolute inset-0 backface-hidden shadow-2xl overflow-hidden",
              isFlipped && "invisible"
            )}
            style={{
              backfaceVisibility: "hidden",
              background: cardData.cardBackgroundColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            }}
          >
            <CardContent className="h-full p-8 text-white relative">
              {/* Union Logo */}
              {cardData.unionLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cardData.unionLogo}
                  alt="Union Logo"
                  className="h-12 mb-6"
                />
              )}

              {/* Status Badge */}
              <div className="absolute top-8 right-8">
                <Badge
                  variant={cardData.status === "active" ? "success" : "destructive"}
                  className="text-xs"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {cardData.status.toUpperCase()}
                </Badge>
              </div>

              {/* Member Photo */}
              {cardData.photoUrl && (
                <div className="absolute bottom-8 left-8 w-24 h-24 rounded-full border-4 border-white overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cardData.photoUrl}
                    alt="Member"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Member Info */}
              <div className={cn("space-y-2", cardData.photoUrl && "ml-32")}>
                <div className="text-2xl font-bold">
                  {cardData.firstName} {cardData.lastName}
                </div>
                <div className="space-y-1 text-sm opacity-90">
                  <div>Member #{cardData.memberNumber}</div>
                  <div>{cardData.chapter}</div>
                </div>
              </div>

              {/* Dates */}
              <div className="absolute bottom-8 right-8 text-right text-sm">
                <div className="opacity-75 mb-1">Member Since</div>
                <div className="font-semibold">
                  {format(cardData.memberSince, "MMM yyyy")}
                </div>
                <div className="opacity-75 mt-2 mb-1">Valid Until</div>
                <div className="font-semibold">
                  {format(cardData.expiryDate, "MMM yyyy")}
                </div>
              </div>

              {/* Decorative Pattern */}
              <div
                className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                }}
              />
            </CardContent>
          </Card>

          {/* Back of Card */}
          <Card
            className={cn(
              "absolute inset-0 backface-hidden shadow-2xl rotate-y-180",
              !isFlipped && "invisible"
            )}
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <CardContent className="h-full p-8 flex flex-col items-center justify-center space-y-6 bg-linear-to-br from-gray-50 to-gray-100">
              {/* QR Code */}
              <div className="bg-white p-6 rounded-lg shadow-inner">
                <div className="w-48 h-48 flex items-center justify-center bg-gray-200 rounded">
                  <QrCode className="h-32 w-32 text-gray-400" />
                  {/* In production, this would be an actual QR code */}
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="font-semibold text-gray-900">
                  Scan to Verify Membership
                </p>
                <p className="text-sm text-gray-600">
                  Member #{cardData.memberNumber}
                </p>
              </div>

              {/* Terms */}
              <div className="text-xs text-gray-500 text-center max-w-md">
                <p className="mb-2">
                  This card is the property of the union and must be returned upon request.
                  It is non-transferable and valid only when accompanied by photo identification.
                </p>
                <p className="font-medium">
                  For assistance, contact: support@union.org
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Wallet Integration */}
      {onAddToWallet && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Add to Mobile Wallet</h3>
                  <p className="text-sm text-gray-600">
                    Access your card quickly from your phone
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddToWallet("google")}
                >
                  Google Wallet
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddToWallet("apple")}
                >
                  Apple Wallet
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card Details */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">Card Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600 mb-1">Member Number</div>
              <div className="font-medium">{cardData.memberNumber}</div>
            </div>
            <div>
              <div className="text-gray-600 mb-1">Status</div>
              <Badge
                variant={cardData.status === "active" ? "success" : "destructive"}
              >
                {cardData.status}
              </Badge>
            </div>
            <div>
              <div className="text-gray-600 mb-1">Member Since</div>
              <div className="font-medium">
                {format(cardData.memberSince, "MMMM d, yyyy")}
              </div>
            </div>
            <div>
              <div className="text-gray-600 mb-1">Expiry Date</div>
              <div className="font-medium">
                {format(cardData.expiryDate, "MMMM d, yyyy")}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-gray-600 mb-1">Chapter</div>
              <div className="font-medium">{cardData.chapter}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

