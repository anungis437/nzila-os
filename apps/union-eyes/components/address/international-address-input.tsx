/**
 * International Address Input Component
 * 
 * Country-aware address form with validation
 * Support for multiple address formats
 * Real-time validation and geocoding
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, MapPin } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

interface AddressFormData {
  countryCode: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  locality: string;
  administrativeArea?: string;
  postalCode?: string;
  addressType: string;
}

interface CountryFormat {
  countryCode: string;
  countryName: string;
  localityLabel: string;
  administrativeAreaLabel: string;
  postalCodeLabel: string;
  requiredFields: string[];
  postalCodePattern: string;
  administrativeAreas?: Array<{ code: string; name: string }>;
}

interface ValidationResult {
  isValid: boolean;
  confidence: string;
  corrections?: Partial<AddressFormData>;
  deliverability?: string;
}

const countries = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "IE", name: "Ireland" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
];

interface InternationalAddressInputProps {
  value?: Partial<AddressFormData>;
  onChange: (address: AddressFormData) => void;
  onValidate?: (valid: boolean) => void;
  autoValidate?: boolean;
  showMap?: boolean;
}

export function InternationalAddressInput({
  value,
  onChange,
  onValidate,
  showMap = false,
}: InternationalAddressInputProps) {
  const [formData, setFormData] = useState<Partial<AddressFormData>>(
    value || { countryCode: "US", addressType: "mailing" }
  );
  const [countryFormat, setCountryFormat] = useState<CountryFormat | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [geocodeResult, setGeocodeResult] = useState<{ lat: string; lng: string } | null>(null);
  
  const { toast } = useToast();
  
  // Load country format when country changes
  useEffect(() => {
    if (formData.countryCode) {
      loadCountryFormat(formData.countryCode);
    }
  }, [formData.countryCode]);
  
  const loadCountryFormat = async (countryCode: string) => {
    try {
      const response = await fetch(
        `/api/address/country-format?countryCode=${countryCode}`
      );
      if (response.ok) {
        const data = await response.json();
        setCountryFormat(data.format);
      }
    } catch (_error) {
}
  };
  
  const updateField = (field: keyof AddressFormData, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    
    // Clear validation when user makes changes
    setValidationResult(null);
    
    if (onChange && isCompleteAddress(updated)) {
      onChange(updated as AddressFormData);
    }
  };
  
  const isCompleteAddress = (data: Partial<AddressFormData>): boolean => {
    if (!data.countryCode || !data.addressLine1 || !data.locality) {
      return false;
    }
    
    if (!countryFormat) return false;
    
    // Check required fields based on country format
    return countryFormat.requiredFields.every((field) => {
      const value = (data as Record<string, unknown>)[field];
      return value !== undefined && value !== "";
    });
  };
  
  const validateAddress = async () => {
    if (!isCompleteAddress(formData)) {
      toast({
        title: "Incomplete Address",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    setIsValidating(true);
    
    try {
      const response = await fetch("/api/address/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        const data = await response.json();
        setValidationResult(data.validation);
        
        // Apply corrections if available
        if (data.validation.corrections) {
          const corrected = { ...formData, ...data.validation.corrections };
          setFormData(corrected);
          
          if (onChange) {
            onChange(corrected as AddressFormData);
          }
          
          toast({
            title: "Address Standardized",
            description: "We've applied suggested corrections",
          });
        }
        
        // Get geocoding if validation succeeded
        if (data.validation.isValid && showMap) {
          const geocodeResponse = await fetch("/api/address/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          
          if (geocodeResponse.ok) {
            const geocodeData = await geocodeResponse.json();
            setGeocodeResult({
              lat: geocodeData.latitude,
              lng: geocodeData.longitude,
            });
          }
        }
        
        if (onValidate) {
          onValidate(data.validation.isValid);
        }
      }
    } catch (_error) {
      toast({
        title: "Validation Failed",
        description: "Unable to validate address",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Country Selection */}
      <div className="space-y-2">
        <Label htmlFor="countryCode">Country *</Label>
        <Select
          value={formData.countryCode}
          onValueChange={(value) => updateField("countryCode", value)}
        >
          <SelectTrigger id="countryCode">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Address Type */}
      <div className="space-y-2">
        <Label htmlFor="addressType">Address Type *</Label>
        <Select
          value={formData.addressType || "mailing"}
          onValueChange={(value) => updateField("addressType", value)}
        >
          <SelectTrigger id="addressType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mailing">Mailing</SelectItem>
            <SelectItem value="residential">Residential</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="shipping">Shipping</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Address Line 1 */}
      <div className="space-y-2">
        <Label htmlFor="addressLine1">
          Address Line 1 *
        </Label>
        <Input
          id="addressLine1"
          value={formData.addressLine1 || ""}
          onChange={(e) => updateField("addressLine1", e.target.value)}
          placeholder="Street address, P.O. box"
        />
      </div>
      
      {/* Address Line 2 */}
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address Line 2</Label>
        <Input
          id="addressLine2"
          value={formData.addressLine2 || ""}
          onChange={(e) => updateField("addressLine2", e.target.value)}
          placeholder="Apartment, suite, unit, building, floor"
        />
      </div>
      
      {/* Locality (City) */}
      <div className="space-y-2">
        <Label htmlFor="locality">
          {countryFormat?.localityLabel || "City"} *
        </Label>
        <Input
          id="locality"
          value={formData.locality || ""}
          onChange={(e) => updateField("locality", e.target.value)}
          placeholder={countryFormat?.localityLabel || "City"}
        />
      </div>
      
      {/* Administrative Area (State/Province) and Postal Code */}
      <div className="grid grid-cols-2 gap-4">
        {/* Administrative Area */}
        {countryFormat?.administrativeAreaLabel && (
          <div className="space-y-2">
            <Label htmlFor="administrativeArea">
              {countryFormat.administrativeAreaLabel}
              {countryFormat.requiredFields.includes("administrativeArea") && " *"}
            </Label>
            {countryFormat.administrativeAreas &&
            countryFormat.administrativeAreas.length > 0 ? (
              <Select
                value={formData.administrativeArea || ""}
                onValueChange={(value) => updateField("administrativeArea", value)}
              >
                <SelectTrigger id="administrativeArea">
                  <SelectValue placeholder={`Select ${countryFormat.administrativeAreaLabel}`} />
                </SelectTrigger>
                <SelectContent>
                  {countryFormat.administrativeAreas.map((area) => (
                    <SelectItem key={area.code} value={area.name}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="administrativeArea"
                value={formData.administrativeArea || ""}
                onChange={(e) => updateField("administrativeArea", e.target.value)}
                placeholder={countryFormat.administrativeAreaLabel}
              />
            )}
          </div>
        )}
        
        {/* Postal Code */}
        <div className="space-y-2">
          <Label htmlFor="postalCode">
            {countryFormat?.postalCodeLabel || "Postal Code"}
            {countryFormat?.requiredFields.includes("postalCode") && " *"}
          </Label>
          <Input
            id="postalCode"
            value={formData.postalCode || ""}
            onChange={(e) => updateField("postalCode", e.target.value)}
            placeholder={countryFormat?.postalCodeLabel || "Postal Code"}
            pattern={countryFormat?.postalCodePattern}
          />
        </div>
      </div>
      
      {/* Validation Button */}
      <div className="flex items-center gap-2">
        <Button
          onClick={validateAddress}
          disabled={!isCompleteAddress(formData) || isValidating}
          variant="outline"
        >
          {isValidating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" />
              Validate Address
            </>
          )}
        </Button>
        
        {validationResult && (
          <div className="flex items-center gap-2">
            {validationResult.isValid ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600 font-medium">
                  Valid Address
                </span>
                <Badge variant="secondary">
                  {validationResult.confidence} confidence
                </Badge>
                {validationResult.deliverability && (
                  <Badge
                    variant={
                      validationResult.deliverability === "deliverable"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {validationResult.deliverability}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-600 font-medium">
                  Invalid Address
                </span>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Validation Corrections */}
      {validationResult?.corrections && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Suggested Corrections Applied
                </p>
                <p className="text-xs text-blue-700">
                  We&apos;ve standardized this address based on postal service data
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Map Preview */}
      {showMap && geocodeResult && (
        <Card>
          <CardContent className="p-0">
            <div className="h-64 relative bg-muted">
              {/* In production, integrate with Google Maps, Mapbox, or similar */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium">Map Preview</p>
                  <p className="text-xs text-muted-foreground">
                    {geocodeResult.lat}, {geocodeResult.lng}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Example usage with form submission
 */
export function AddressFormExample() {
  const [address, setAddress] = useState<Partial<AddressFormData>>({});
  const [isValid, setIsValid] = useState(false);
  const { toast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      toast({
        title: "Invalid Address",
        description: "Please validate the address before submitting",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await fetch("/api/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(address),
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Address saved successfully",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to save address",
        variant: "destructive",
      });
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <InternationalAddressInput
        value={address}
        onChange={setAddress}
        onValidate={setIsValid}
        autoValidate
        showMap
      />
      
      <Button type="submit" disabled={!isValid}>
        Save Address
      </Button>
    </form>
  );
}

