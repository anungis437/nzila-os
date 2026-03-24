/**
 * Edit Member Page
 * 
 * Edit existing member information
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/index';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from "next-intl";
import { ArrowLeft, Save } from 'lucide-react';

interface MemberFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  status: string;
  localId: string;
  classification: string;
  jobTitle: string;
  employerId: string;
  hireDate: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
}

export default function EditMemberPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const t = useTranslations("members.edit");
  const [formData, setFormData] = useState<MemberFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    status: 'active',
    localId: '',
    classification: 'full_time',
    jobTitle: '',
    employerId: '',
    hireDate: '',
    address: '',
    city: '',
    province: 'ON',
    postalCode: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMember();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchMember = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await api.members.get(params.id) as Record<string, any>;
      
      setFormData({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        dateOfBirth: data.dateOfBirth || '',
        status: data.status || 'active',
        localId: data.localId || '',
        classification: data.classification || '',
        jobTitle: data.jobTitle || '',
        employerId: data.employerId || '',
        hireDate: data.hireDate || '',
        address: data.address || '',
        city: data.city || '',
        province: data.province || 'ON',
        postalCode: data.postalCode || '',
      });
    } catch (error) {
      logger.error('Error fetching member', error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof MemberFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await api.members.update(params.id, formData);
      router.push(`/members/${params.id}`);
    } catch (error) {
      logger.error('Error updating member', error);
      alert('Failed to update member');
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6">{t("loading")}</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t("heading")}</h1>
          <p className="text-muted-foreground">
            {t("subheading")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList>
            <TabsTrigger value="basic">{t("tabBasic")}</TabsTrigger>
            <TabsTrigger value="employment">{t("tabEmployment")}</TabsTrigger>
            <TabsTrigger value="contact">{t("tabContact")}</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <Card className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("firstNameLabel")} *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("lastNameLabel")} *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("emailLabel")} *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t("phoneLabel")} *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">{t("dateOfBirthLabel")}</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateField('dateOfBirth', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{t("statusLabel")} *</Label>
                <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("statusActive")}</SelectItem>
                    <SelectItem value="inactive">{t("statusInactive")}</SelectItem>
                    <SelectItem value="suspended">{t("statusSuspended")}</SelectItem>
                    <SelectItem value="retired">{t("statusRetired")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="employment">
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="localId">{t("localLabel")} *</Label>
                <Select value={formData.localId} onValueChange={(v) => updateField('localId', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local-123">{t("localOption1")}</SelectItem>
                    <SelectItem value="local-456">{t("localOption2")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="classification">{t("classificationLabel")} *</Label>
                <Select
                  value={formData.classification}
                  onValueChange={(v) => updateField('classification', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">{t("classificationFullTime")}</SelectItem>
                    <SelectItem value="part_time">{t("classificationPartTime")}</SelectItem>
                    <SelectItem value="casual">{t("classificationCasual")}</SelectItem>
                    <SelectItem value="seasonal">{t("classificationSeasonal")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobTitle">{t("jobTitleLabel")} *</Label>
                <Input
                  id="jobTitle"
                  value={formData.jobTitle}
                  onChange={(e) => updateField('jobTitle', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employerId">{t("employerLabel")}</Label>
                <Select value={formData.employerId} onValueChange={(v) => updateField('employerId', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emp-1">{t("employerOption1")}</SelectItem>
                    <SelectItem value="emp-2">{t("employerOption2")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hireDate">{t("hireDateLabel")} *</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => updateField('hireDate', e.target.value)}
                  required
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contact">
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">{t("addressLabel")}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t("cityLabel")}</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="province">{t("provinceLabel")}</Label>
                  <Select value={formData.province} onValueChange={(v) => updateField('province', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ON">{t("provinceON")}</SelectItem>
                      <SelectItem value="QC">{t("provinceQC")}</SelectItem>
                      <SelectItem value="BC">{t("provinceBC")}</SelectItem>
                      <SelectItem value="AB">{t("provinceAB")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">{t("postalCodeLabel")}</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                />
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancelButton")}
          </Button>
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            {t("saveButton")}
          </Button>
        </div>
      </form>
    </div>
  );
}
