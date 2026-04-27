/**
 * Member Detail Page
 * View detailed member profile with claims history
 */
"use client";


export const dynamic = 'force-dynamic';
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from 'next-intl';
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Shield,
  FileText,
  ArrowLeft,
  Edit,
  Clock,
  AlertCircle,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then(res => res.json());

type MemberRole = "member" | "steward" | "officer" | "admin" | "super_admin";
type MemberStatus = "active" | "inactive" | "on-leave";

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: MemberRole;
  status: MemberStatus;
  department: string;
  position: string;
  hireDate: string;
  seniority: number;
  membershipNumber: string;
  unionJoinDate: string;
}

interface Claim {
  id: string;
  claimNumber: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('memberDetailPage');
  const memberId = params.id as string;

  const roleConfig: Record<MemberRole, { label: string; color: string }> = {
    member: { label: t('role.member'), color: "text-blue-700 bg-blue-100 border-blue-200" },
    steward: { label: t('role.steward'), color: "text-purple-700 bg-purple-100 border-purple-200" },
    officer: { label: t('role.officer'), color: "text-orange-700 bg-orange-100 border-orange-200" },
    admin: { label: t('role.admin'), color: "text-red-700 bg-red-100 border-red-200" },
    super_admin: { label: t('role.superAdmin'), color: "text-red-900 bg-red-200 border-red-300" }
  };

  const statusConfig: Record<MemberStatus, { label: string; color: string }> = {
    active: { label: t('status.active'), color: "text-green-700 bg-green-100 border-green-200" },
    inactive: { label: t('status.inactive'), color: "text-gray-700 bg-gray-100 border-gray-200" },
    "on-leave": { label: t('status.onLeave'), color: "text-yellow-700 bg-yellow-100 border-yellow-200" }
  };

  const defaultBadge = { label: t('unknownBadge'), color: "text-gray-700 bg-gray-100 border-gray-200" };

  const getRoleConfig = (role: string | null | undefined) => {
    if (!role) return defaultBadge;
    return roleConfig[role as MemberRole] ?? { ...defaultBadge, label: role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
  };

  const getStatusConfig = (status: string | null | undefined) => {
    if (!status) return defaultBadge;
    return statusConfig[status as MemberStatus] ?? { ...defaultBadge, label: status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
  };

  // Fetch member data
  const { data: memberData, error: memberError, isLoading: memberLoading } = useSWR(
    `/api/members/${memberId}`,
    fetcher
  );

  // Fetch member's claims
  const { data: claimsData, error: _claimsError, isLoading: claimsLoading } = useSWR(
    `/api/members/${memberId}/claims`,
    fetcher
  );

  // CRUD factory returns { data: row } inside the withApi envelope { success, data: { data: row } }
  const member: Member | null = memberData?.success ? (memberData.data?.data ?? memberData.data) : null;
  // Claims list returns array directly inside the envelope
  const claimsRaw = claimsData?.success ? claimsData.data : [];
  const claims: Claim[] = Array.isArray(claimsRaw) ? claimsRaw : (claimsRaw?.data ?? []);

  if (memberLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">{t('loadingMessage')}</p>
        </div>
      </div>
    );
  }

  if (memberError || !member) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('notFoundTitle')}</h2>
          <p className="text-gray-600 mb-4">{t('notFoundDescription')}</p>
          <button
            onClick={() => router.push(`/${locale}/dashboard/members`)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('backToMembers')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/${locale}/dashboard/members`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMembers')}
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <User className="w-10 h-10 text-blue-600" />
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">{member.name}</h1>
                  <p className="text-lg text-gray-600">{member.position}</p>
                </div>
              </div>
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              {t('editProfileButton')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Member Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Status Card */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('statusTitle')}</h3>
                <div className="space-y-3">
                  <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getRoleConfig(member.role).color}`}>
                      <Shield className="w-3 h-3 mr-2" />
                      {getRoleConfig(member.role).label}
                    </span>
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusConfig(member.status).color}`}>
                      {getStatusConfig(member.status).label}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('contactInformationTitle')}</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">{t('emailLabel')}</p>
                      <a href={`mailto:${member.email}`} className="text-blue-600 hover:underline">
                        {member.email}
                      </a>
                    </div>
                  </div>
                  {member.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">{t('phoneLabel')}</p>
                        <a href={`tel:${member.phone}`} className="text-blue-600 hover:underline">
                          {member.phone}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Work Info */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('workInformationTitle')}</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">{t('departmentLabel')}</p>
                      <p className="text-gray-900">{member.department}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">{t('hireDateLabel')}</p>
                      <p className="text-gray-900">
                        {new Date(member.hireDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">{t('seniorityLabel')}</p>
                      <p className="text-gray-900">{t('seniorityYears', { years: member.seniority })}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Union Info */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('unionInformationTitle')}</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">{t('membershipNumberLabel')}</p>
                    <p className="text-gray-900 font-mono">{member.membershipNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{t('unionJoinDateLabel')}</p>
                    <p className="text-gray-900">
                      {new Date(member.unionJoinDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Claims History */}
          <div className="lg:col-span-2">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">{t('claimsHistoryTitle')}</h3>
                  <span className="text-sm text-gray-600">
                    {claims.length === 1 ? t('claimCountOne', { count: claims.length }) : t('claimCountOther', { count: claims.length })}
                  </span>
                </div>

                {claimsLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                    <p className="text-gray-600">{t('loadingClaims')}</p>
                  </div>
                ) : claims.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">{t('noClaimsFound')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {claims.map((claim) => (
                      <motion.div
                        key={claim.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => router.push(`/dashboard/claims/${claim.id}`)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900">{claim.claimNumber}</h4>
                            <p className="text-gray-600 text-sm">{claim.title}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            claim.status === 'resolved' 
                              ? 'bg-green-100 text-green-700' 
                              : claim.status === 'in-progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {claim.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {t('createdDateLabel', { date: new Date(claim.createdAt).toLocaleDateString() })}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${
                              claim.priority === 'high' 
                                ? 'bg-red-500' 
                                : claim.priority === 'medium'
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`} />
                            {t('priorityLabel', { priority: claim.priority })}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
