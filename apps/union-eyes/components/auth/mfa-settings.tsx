"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface MfaStatus {
  enrolled: boolean;
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodeCount: number;
}

interface EnrollResponse {
  otpAuthUri: string;
  secret: string;
  recoveryCodes: string[];
}

export function MfaSettings() {
  const t = useTranslations("mfaSettings");
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollResponse | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [confirmedCodes, setConfirmedCodes] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/status", { cache: "no-store" });
      if (!res.ok) {
        setError(t("statusLoadError"));
        return;
      }
      setStatus(await res.json());
    } catch {
      setError(t("statusLoadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function startEnrollment() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("enrollmentFailed"));
        return;
      }
      setEnrollment(data);
      setConfirmedCodes(false);
    } catch {
      setError(t("enrollmentFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/verify-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("invalidCode"));
        return;
      }
      setEnrollment(null);
      setVerifyCode("");
      await loadStatus();
    } catch {
      setError(t("verificationFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    if (!window.confirm(t("disableConfirm"))) {
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "user_disabled" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("disableError"));
        return;
      }
      await loadStatus();
    } catch {
      setError(t("disableError"));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !status && !enrollment) {
    return <p className="text-sm text-gray-500">{t("loading")}</p>;
  }

  if (enrollment) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(enrollment.otpAuthUri)}`;

    return (
      <div className="space-y-6 border border-gray-200 rounded-xl p-6 bg-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("step1Title")}</h2>
          <p className="text-sm text-gray-600 mt-1">{t("step1Body")}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={t("qrAlt")}
            width={240}
            height={240}
            className="border border-gray-200 rounded-lg"
          />
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700">{t("manualSecretLabel")}</label>
            <code className="block mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs break-all">
              {enrollment.secret}
            </code>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("step2Title")}</h2>
          <p className="text-sm text-gray-600 mt-1">{t("step2Body")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm">
            {enrollment.recoveryCodes.map((code) => (
              <div key={code}>{code}</div>
            ))}
          </div>
          <label className="flex items-start gap-2 mt-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={confirmedCodes}
              onChange={(e) => setConfirmedCodes(e.target.checked)}
              className="mt-0.5"
            />
            <span>{t("confirmCodes")}</span>
          </label>
        </div>

        <form onSubmit={verifyEnrollment} className="space-y-3 pt-4 border-t border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{t("step3Title")}</h2>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            maxLength={6}
            required
            className="w-full max-w-xs rounded-xl border border-gray-200 px-4 py-2.5 text-sm tracking-widest"
            placeholder={t("codePlaceholder")}
          />
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !confirmedCodes}
              className="bg-electric hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl disabled:opacity-50"
            >
              {loading ? t("verifyingButton") : t("verifyButton")}
            </button>
            <button
              type="button"
              onClick={() => {
                setEnrollment(null);
                setVerifyCode("");
                setConfirmedCodes(false);
                setError(null);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-6 bg-white">
      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>
      )}
      {status?.enabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
            <span className="font-medium text-gray-900">{t("enabledStatus")}</span>
          </div>
          {status.enabledAt && (
            <p className="text-sm text-gray-600">
              {t("enabledOn", { date: new Date(status.enabledAt).toLocaleDateString() })}
            </p>
          )}
          <p className="text-sm text-gray-600">
            {t("recoveryCodesRemaining", { count: status.recoveryCodeCount })}
          </p>
          <button
            type="button"
            onClick={disable}
            disabled={loading}
            className="text-sm text-red-600 hover:text-red-800 underline"
          >
            {t("disableAction")}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-gray-300 rounded-full" />
            <span className="font-medium text-gray-900">{t("disabledStatus")}</span>
          </div>
          <p className="text-sm text-gray-600">{t("disabledBody")}</p>
          <button
            type="button"
            onClick={startEnrollment}
            disabled={loading}
            className="bg-electric hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl disabled:opacity-50"
          >
            {loading ? t("preparingButton") : t("enableAction")}
          </button>
        </div>
      )}
    </div>
  );
}
