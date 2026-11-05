/**
 * Member Detail Page
 *
 * One member of the organization, read from GET /api/members/{id} (the CRUD item route, which answers withApi's { success, data: { data: row } }),
 * with the claims filed by or assigned to the member from GET /api/members/{id}/claims (a plain list: { success, data: [claims] }). Each is
 * read strictly. A call that failed is said to have failed, with the route's reason and a retry: it is never shown as a member that does not
 * exist or as a member with no claims. A figure the record does not hold is a dash, not a date in 1970 or "null years".
 */
"use client";

export const dynamic = 'force-dynamic';
import Link from "next/link";
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
  Clock,
  AlertCircle,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { envelopeRow, readApiError } from "@/lib/client/api-envelope";
import { ApiShapeError, asRecord, countOrNull, humanize, isRecord, optionalString, requiredDate, requiredString } from "@/lib/client/row-fields";

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  department: string | null;
  position: string | null;
  hireDate: Date | null;
  /** Years, when the record holds them: null is unknown, not zero. */
  seniority: number | null;
  membershipNumber: string | null;
  unionJoinDate: Date | null;
}

interface Claim {
  id: string;
  claimId: string;
  /** Legacy claims were filed before numbering. */
  claimNumber: string | null;
  claimType: string | null;
  status: string;
  priority: string;
  createdAt: Date | null;
}

const optionalDate = (row: Record<string, unknown>, key: string): Date | null => (row[key] === null ? null : requiredDate(row, key));

function toMember(row: Record<string, unknown>): Member {
  return {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    email: requiredString(row, "email"),
    phone: optionalString(row, "phone"),
    role: requiredString(row, "role"),
    status: requiredString(row, "status"),
    department: optionalString(row, "department"),
    position: optionalString(row, "position"),
    hireDate: optionalDate(row, "hireDate"),
    seniority: countOrNull(row, "seniority"),
    membershipNumber: optionalString(row, "membershipNumber"),
    unionJoinDate: optionalDate(row, "unionJoinDate"),
  };
}

function toClaim(raw: unknown): Claim {
  const row = asRecord(raw, "claim");
  return {
    id: requiredString(row, "id"),
    claimId: requiredString(row, "claimId"),
    claimNumber: optionalString(row, "claimNumber"),
    claimType: optionalString(row, "claimType"),
    status: requiredString(row, "status"),
    priority: requiredString(row, "priority"),
    createdAt: optionalDate(row, "createdAt"),
  };
}

class ReadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ReadError";
  }
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new ReadError(await readApiError(response, `Request failed with status ${response.status}`), response.status);
  return response.json();
}

const memberFetcher = async (url: string): Promise<Member> => toMember(envelopeRow(await getJson(url)));

const claimsFetcher = async (url: string): Promise<Claim[]> => {
  const body = await getJson(url);
  if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError("no list");
  return body.data.map(toClaim);
};

const NEUTRAL = "text-gray-700 bg-gray-100 border-gray-200";
const ROLE_COLORS: Record<string, string> = {
  member: "text-blue-700 bg-blue-100 border-blue-200",
  steward: "text-purple-700 bg-purple-100 border-purple-200",
  officer: "text-orange-700 bg-orange-100 border-orange-200",
  admin: "text-red-700 bg-red-100 border-red-200",
  super_admin: "text-red-900 bg-red-200 border-red-300",
};
const STATUS_COLORS: Record<string, string> = {
  active: "text-green-700 bg-green-100 border-green-200",
  inactive: NEUTRAL,
  "on-leave": "text-yellow-700 bg-yellow-100 border-yellow-200",
  on_leave: "text-yellow-700 bg-yellow-100 border-yellow-200",
};

const CLAIM_STATUS_COLORS: Record<string, string> = {
  resolved: "bg-green-100 text-green-700",
  closed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  under_review: "bg-blue-100 text-blue-700",
  assigned: "bg-blue-100 text-blue-700",
  investigation: "bg-blue-100 text-blue-700",
  pending_documentation: "bg-yellow-100 text-yellow-700",
};

const PRIORITY_DOTS: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const UNKNOWN = "—";

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('memberDetailPage');
  const memberId = encodeURIComponent(params.id as string);

  // The roles and statuses the screen has words for; any other code is shown as its own words.
  const roleLabels: Record<string, string> = {
    member: t('role.member'),
    steward: t('role.steward'),
    officer: t('role.officer'),
    admin: t('role.admin'),
    super_admin: t('role.superAdmin'),
  };
  const statusLabels: Record<string, string> = {
    active: t('status.active'),
    inactive: t('status.inactive'),
    "on-leave": t('status.onLeave'),
    on_leave: t('status.onLeave'),
  };

  // The dates a member record holds are calendar days kept as midnight UTC: shown in the viewer's zone, one of them would be the day before.
  const formatDay = (date: Date | null) => (date ? date.toLocaleDateString(locale, { timeZone: "UTC" }) : UNKNOWN);

  const memberKey = `/api/members/${memberId}`;
  const claimsKey = `/api/members/${memberId}/claims`;
  const { data: member, error: memberError, isLoading: memberLoading, mutate: reloadMember } = useSWR<Member, Error>(memberKey, memberFetcher, { shouldRetryOnError: false });
  const { data: claims, error: claimsError, isLoading: claimsLoading, mutate: reloadClaims } = useSWR<Claim[], Error>(claimsKey, claimsFetcher, { shouldRetryOnError: false });

  if (memberLoading || (!member && !memberError)) {
    return (
      <div role="status" aria-label={t('loadingMessage')} className="flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">{t('loadingMessage')}</p>
        </div>
      </div>
    );
  }

  if (memberError || !member) {
    const notFound = memberError instanceof ReadError && memberError.status === 404;
    return (
      <div className="flex items-center justify-center">
        <div role="alert" className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{notFound ? t('notFoundTitle') : t('loadFailedTitle')}</h2>
          <p className="text-gray-600 mb-4">{notFound ? t('notFoundDescription') : memberError?.message}</p>
          <div className="flex items-center justify-center gap-3">
            {!notFound && (
              <button
                onClick={() => void reloadMember()}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('retryButton')}
              </button>
            )}
            <button
              onClick={() => router.push(`/${locale}/dashboard/members`)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('backToMembers')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roleClass = ROLE_COLORS[member.role] ?? NEUTRAL;
  const statusClass = STATUS_COLORS[member.status] ?? NEUTRAL;

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

          <div className="flex items-center gap-3 mb-2">
            <User className="w-10 h-10 text-blue-600" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900">{member.name}</h1>
              {member.position && <p className="text-lg text-gray-600">{member.position}</p>}
            </div>
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
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border capitalize ${roleClass}`}>
                      <Shield className="w-3 h-3 mr-2" />
                      {roleLabels[member.role] ?? humanize(member.role)}
                    </span>
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border capitalize ${statusClass}`}>
                      {statusLabels[member.status] ?? humanize(member.status)}
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
                      <p className="text-gray-900">{member.department ?? UNKNOWN}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">{t('hireDateLabel')}</p>
                      <p className="text-gray-900">{formatDay(member.hireDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">{t('seniorityLabel')}</p>
                      <p className="text-gray-900">{member.seniority === null ? UNKNOWN : t('seniorityYears', { years: member.seniority })}</p>
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
                    <p className="text-gray-900 font-mono">{member.membershipNumber ?? UNKNOWN}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{t('unionJoinDateLabel')}</p>
                    <p className="text-gray-900">{formatDay(member.unionJoinDate)}</p>
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
                  {claims !== undefined && !claimsError && (
                    <span className="text-sm text-gray-600">
                      {claims.length === 1 ? t('claimCountOne', { count: claims.length }) : t('claimCountOther', { count: claims.length })}
                    </span>
                  )}
                </div>

                {claimsError ? (
                  <div role="alert" className="text-center py-12">
                    <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
                    <p className="text-gray-900 font-medium">{t('claimsLoadFailed')}</p>
                    <p className="text-gray-600 text-sm mb-4">{claimsError.message}</p>
                    <button
                      onClick={() => void reloadClaims()}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {t('retryButton')}
                    </button>
                  </div>
                ) : claimsLoading || claims === undefined ? (
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
                  <ul className="space-y-4">
                    {claims.map((claim) => (
                      <motion.li
                        key={claim.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Link
                          href={`/${locale}/dashboard/claims/${encodeURIComponent(claim.claimId)}`}
                          className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-900">{claim.claimNumber ?? t('noClaimNumber')}</h4>
                              {claim.claimType && <p className="text-gray-600 text-sm capitalize">{humanize(claim.claimType)}</p>}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${CLAIM_STATUS_COLORS[claim.status] ?? "bg-gray-100 text-gray-700"}`}>
                              {humanize(claim.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {claim.createdAt && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {t('createdDateLabel', { date: claim.createdAt.toLocaleDateString(locale) })}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[claim.priority] ?? "bg-gray-400"}`} />
                              {t('priorityLabel', { priority: humanize(claim.priority) })}
                            </div>
                          </div>
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
