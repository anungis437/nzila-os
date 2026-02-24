/**
 * User Role Select Component
 * 
 * Dropdown for changing user roles with optimistic updates and server action integration.
 * Part of Phase 0.2 - Admin Console UI
 */

"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
 
 
import { useToast } from "@/lib/hooks/use-toast";

type UserRole = "member" | "steward" | "officer" | "admin";

interface UserRoleSelectProps {
  userId: string;
  organizationId: string;
  currentRole: UserRole;
}

const ROLE_CONFIG = {
  member: {
    label: "Member",
    color: "bg-green-100 text-green-800",
    icon: "👤",
    description: "Standard member access",
  },
  steward: {
    label: "Steward",
    color: "bg-blue-100 text-blue-800",
    icon: "🛡️",
    description: "Representative level access",
  },
  officer: {
    label: "Officer",
    color: "bg-orange-100 text-orange-800",
    icon: "⭐",
    description: "Management level access",
  },
  admin: {
    label: "Admin",
    color: "bg-red-100 text-red-800",
    icon: "👑",
    description: "Full system access",
  },
};

export function UserRoleSelect({ userId: _userId, organizationId: _organizationId, currentRole }: UserRoleSelectProps) {
  const [role, setRole] = useState<UserRole>(currentRole);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleRoleChange = async (newRole: UserRole) => {
    // Optimistic update
    setRole(newRole);

    startTransition(async () => {
      try {
        // TODO: Call server action when integrated with RLS
        // await updateUserRole(userId, organizationId, newRole);
        
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        toast({
          title: "Role updated",
          description: `User role changed to ${ROLE_CONFIG[newRole].label}`,
        });
      } catch (_error) {
        // Revert on error
        setRole(currentRole);
        toast({
          title: "Error",
          description: "Failed to update user role",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={role}
        onValueChange={(value) => handleRoleChange(value as UserRole)}
        disabled={isPending}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue>
            <div className="flex items-center gap-2">
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span>{ROLE_CONFIG[role].icon}</span>
              )}
              <span>{ROLE_CONFIG[role].label}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ROLE_CONFIG).map(([key, config]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <span>{config.icon}</span>
                <div>
                  <div className="font-medium">{config.label}</div>
                  <div className="text-xs text-gray-500">{config.description}</div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
