"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { getJson, postJson, UNEXPECTED_MESSAGE } from "./auth-client";

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

/** /api/auth/mfa/status answers { enrolled, enabled, enabledAt, recoveryCodeCount }: an answer without them is not "two-factor is off". */
function readStatus(data: Record<string, unknown>): MfaStatus | null {
  const { enrolled, enabled, enabledAt, recoveryCodeCount } = data;
  if (typeof enrolled !== "boolean" || typeof enabled !== "boolean") return null;
  if (enabledAt !== null && (typeof enabledAt !== "string" || Number.isNaN(Date.parse(enabledAt)))) return null;
  if (typeof recoveryCodeCount !== "number" || !Number.isInteger(recoveryCodeCount) || recoveryCodeCount < 0) return null;
  return { enrolled, enabled, enabledAt, recoveryCodeCount };
}

/** /api/auth/mfa/enroll answers { otpAuthUri, secret, recoveryCodes }: all three are needed to finish enrolling. */
function readEnrollment(data: Record<string, unknown>): EnrollResponse | null {
  const { otpAuthUri, secret, recoveryCodes } = data;
  if (typeof otpAuthUri !== "string" || !otpAuthUri.startsWith("otpauth://") || typeof secret !== "string" || !secret) return null;
  if (!Array.isArray(recoveryCodes) || recoveryCodes.length === 0 || !recoveryCodes.every((code) => typeof code === "string" && code !== "")) return null;
  return { otpAuthUri, secret, recoveryCodes: recoveryCodes as string[] };
}

/**
 * The enrollment link carries the authenticator secret, so the code is drawn here, in the browser: the address is never sent to a QR service.
 * When it cannot be drawn the manual setup secret below it still completes enrollment, and the person is told why the image is missing.
 */
function EnrollmentQr({ uri, alt, unavailable }: { uri: string; alt: string; unavailable: string }) {
  const [image, setImage] = useState<{ uri: string; src: string | null } | null>(null);

  useEffect(() => {
    let current = true;
    QRCode.toDataURL(uri, { width: 240, margin: 1 }).then(
      (src) => {
        if (current) setImage({ uri, src });
      },
      () => {
        if (current) setImage({ uri, src: null });
      },
    );
    return () => {
      current = false;
    };
  }, [uri]);

  if (image === null || image.uri !== uri) return <div className="h-60 w-60 rounded-lg border border-gray-200" role="status" aria-busy="true" />;
  if (image.src === null) return <p role="alert" className="max-w-60 text-sm text-red-700">{unavailable}</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.src} alt={alt} width={240} height={240} className="border border-gray-200 rounded-lg" />;
}

export function MfaSettings() {
  const t = useTranslations("mfaSettings");
  const locale = useLocale();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollResponse | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [confirmedCodes, setConfirmedCodes] = useState(false);

  // What the person is told: the screen's own wording, followed by the route's reason when it gave one.
  const failure = useCallback((title: string, reason: string) => (reason === title ? title : `${title}: ${reason}`), []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const title = t("statusLoadError");
      const answer = await getJson("/api/auth/mfa/status", title);
      if (!answer.ok) {
        setError(failure(title, answer.message));
        return;
      }
      const read = readStatus(answer.data);
      if (read === null) {
        setError(failure(title, UNEXPECTED_MESSAGE));
        return;
      }
      setStatus(read);
    } finally {
      setLoading(false);
    }
  }, [t, failure]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function startEnrollment() {
    setError(null);
    setLoading(true);
    try {
      const title = t("enrollmentFailed");
      const answer = await postJson("/api/auth/mfa/enroll", {}, title);
      if (!answer.ok) {
        setError(failure(title, answer.message));
        return;
      }
      const read = readEnrollment(answer.data);
      if (read === null) {
        setError(failure(title, UNEXPECTED_MESSAGE));
        return;
      }
      setEnrollment(read);
      setConfirmedCodes(false);
    } finally {
      setLoading(false);
    }
  }

  async function verifyEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const title = t("invalidCode");
      const answer = await postJson("/api/auth/mfa/verify-enroll", { code: verifyCode.trim() }, title);
      if (!answer.ok) {
        setError(failure(t("verificationFailed"), answer.message));
        return;
      }
      // The route confirms with { ok: true }; without it the account is not known to have two-factor on.
      if (answer.data.ok !== true) {
        setError(failure(t("verificationFailed"), UNEXPECTED_MESSAGE));
        return;
      }
      setEnrollment(null);
      setVerifyCode("");
      await loadStatus();
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
      const title = t("disableError");
      const answer = await postJson("/api/auth/mfa/disable", { reason: "user_disabled" }, title);
      if (!answer.ok) {
        setError(failure(title, answer.message));
        return;
      }
      if (answer.data.ok !== true) {
        setError(failure(title, UNEXPECTED_MESSAGE));
        return;
      }
      await loadStatus();
    } finally {
      setLoading(false);
    }
  }

  if (loading && !status && !enrollment) {
    return <p className="text-sm text-gray-500">{t("loading")}</p>;
  }

  if (enrollment) {
    return (
      <div className="space-y-6 border border-gray-200 rounded-xl p-6 bg-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("step1Title")}</h2>
          <p className="text-sm text-gray-600 mt-1">{t("step1Body")}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <EnrollmentQr uri={enrollment.otpAuthUri} alt={t("qrAlt")} unavailable={t("qrUnavailable")} />
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
              {t("enabledOn", { date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(status.enabledAt)) })}
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
