/**
 * Member Profile Detail Page
 * 
 * Comprehensive member profile with tabs for contact, employment, documents, history
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/index';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 
import {
  User,
  Mail,
  Phone,
  Briefcase,
  History as _History,
  Edit,
  MoreVertical,
} from 'lucide-react';

interface MemberProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  joinedAt: string;
  local: string;
  classification: string;
  jobTitle: string;
  steward: boolean;
  officer: boolean;
}

export default function MemberProfilePage({ params }: { params: { id: string } }) {
  const _router = useRouter();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchProfile = async () => {
    try {
      const data = await api.members.get(params.id);
      setProfile(data as MemberProfile);
    } catch (error) {
      logger.error('Error fetching profile', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Member not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex gap-4">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{profile.fullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={profile.status === 'active' ? 'default' : 'secondary'}>
                {profile.status}
              </Badge>
              {profile.steward && <Badge variant="outline">Steward</Badge>}
              {profile.officer && <Badge variant="outline">Officer</Badge>}
            </div>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {profile.email}
              </div>
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {profile.phone}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
          <Button variant="outline" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Member Since</div>
          <div className="text-xl font-bold">
            {new Date(profile.joinedAt).toLocaleDateString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Local</div>
          <div className="text-xl font-bold">{profile.local}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Classification</div>
          <div className="text-xl font-bold capitalize">
            {profile.classification.replace('_', ' ')}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Dues Status</div>
          <div className="text-xl font-bold text-green-600">Current</div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="dues">Dues</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Full Name</dt>
                  <dd className="text-sm font-medium">{profile.fullName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Email</dt>
                  <dd className="text-sm font-medium">{profile.email}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Phone</dt>
                  <dd className="text-sm font-medium">{profile.phone}</dd>
                </div>
              </dl>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Employment Information
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Job Title</dt>
                  <dd className="text-sm font-medium">{profile.jobTitle}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Classification</dt>
                  <dd className="text-sm font-medium capitalize">
                    {profile.classification.replace('_', ' ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Local</dt>
                  <dd className="text-sm font-medium">{profile.local}</dd>
                </div>
              </dl>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employment">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Employment Details</h3>
            <p className="text-muted-foreground">
              Employment details interface will be implemented here
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Contact Preferences</h3>
            <p className="text-muted-foreground">
              Contact preferences interface will be implemented here
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Documents</h3>
            <p className="text-muted-foreground">
              Document management interface will be implemented here
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="cases">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Cases & Grievances</h3>
            <p className="text-muted-foreground">
              Cases list will be implemented here
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="dues">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Dues History</h3>
            <p className="text-muted-foreground">
              Dues ledger will be implemented here
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Member History</h3>
            <p className="text-muted-foreground">
              Timeline of member events will be implemented here
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
