import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { TrustMetrics } from '@/types/marketing';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: '#475569',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48.5%',
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 9,
    color: '#475569',
  },
  statusValue: {
    fontSize: 9,
    fontWeight: 700,
  },
  bodyText: {
    fontSize: 9,
    lineHeight: 1.45,
    marginBottom: 4,
  },
  listLine: {
    fontSize: 9,
    marginBottom: 3,
  },
  footer: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    fontSize: 8,
    color: '#64748b',
  },
});

function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return '#047857';
    case 'degraded':
      return '#b45309';
    case 'error':
      return '#b91c1c';
    default:
      return '#475569';
  }
}

function verificationText(value: boolean): string {
  return value ? 'Verified' : 'Not verified';
}

export function TrustMetricsPdfDocument({ metrics }: { metrics: TrustMetrics }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>UnionEyes Trust Infrastructure Report</Text>
          <Text style={styles.subtitle}>
            Generated {metrics.lastUpdated.toISOString()} for governance, buyer, and operational review.
          </Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Immutability Enforcement</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={[styles.statusValue, { color: statusColor(metrics.immutability.status) }]}>
                {metrics.immutability.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.bodyText}>{metrics.immutability.description}</Text>
            <Text style={styles.listLine}>{verificationText(metrics.immutability.verification)}</Text>
            <Text style={styles.listLine}>Triggers active: {metrics.immutability.triggersActive ? 'Yes' : 'No'}</Text>
            <Text style={styles.listLine}>Violation attempts: {metrics.immutability.violationAttempts}</Text>
            <Text style={styles.listLine}>
              Tables protected: {metrics.immutability.tablesProtected.join(', ') || 'None reported'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Row-Level Security</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={[styles.statusValue, { color: statusColor(metrics.rlsEnforcement.status) }]}>
                {metrics.rlsEnforcement.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.bodyText}>{metrics.rlsEnforcement.description}</Text>
            <Text style={styles.listLine}>{verificationText(metrics.rlsEnforcement.verification)}</Text>
            <Text style={styles.listLine}>Policies active: {metrics.rlsEnforcement.policiesActive}</Text>
            <Text style={styles.listLine}>Org isolation: {metrics.rlsEnforcement.orgIsolation}</Text>
            <Text style={styles.listLine}>
              Protected tables: {metrics.rlsEnforcement.tablesProtected.join(', ') || 'None reported'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>FSM Validation</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={[styles.statusValue, { color: statusColor(metrics.fsmValidation.status) }]}>
                {metrics.fsmValidation.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.bodyText}>{metrics.fsmValidation.description}</Text>
            <Text style={styles.listLine}>{verificationText(metrics.fsmValidation.verification)}</Text>
            <Text style={styles.listLine}>
              Invalid transitions blocked: {metrics.fsmValidation.invalidTransitionsBlocked}
            </Text>
            <Text style={styles.listLine}>Compliance rate: {metrics.fsmValidation.complianceRate}%</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Governance Structure</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={[styles.statusValue, { color: statusColor(metrics.governance.status) }]}>
                {metrics.governance.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.bodyText}>{metrics.governance.description}</Text>
            <Text style={styles.listLine}>{verificationText(metrics.governance.verification)}</Text>
            <Text style={styles.listLine}>
              Golden share: {metrics.governance.goldenShareActive ? 'Active' : 'Inactive'}
            </Text>
            <Text style={styles.listLine}>Holder: {metrics.governance.goldenShareHolder}</Text>
            <Text style={styles.listLine}>
              Reserved matters protection: {metrics.governance.reservedMattersProtection}
            </Text>
          </View>

          <View style={[styles.card, { width: '100%' }]}>
            <Text style={styles.cardTitle}>Audit Log Integrity</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={[styles.statusValue, { color: statusColor(metrics.auditLog.status) }]}>
                {metrics.auditLog.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.bodyText}>{metrics.auditLog.description}</Text>
            <Text style={styles.listLine}>{verificationText(metrics.auditLog.verification)}</Text>
            <Text style={styles.listLine}>Events logged (30 days): {metrics.auditLog.eventsLogged.toLocaleString()}</Text>
            <Text style={styles.listLine}>Archived events: {metrics.auditLog.archivedEvents.toLocaleString()}</Text>
            <Text style={styles.listLine}>Retention policy: {metrics.auditLog.retentionPolicy}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This report is generated from live trust metric checks in the UnionEyes runtime. Unknown states represent unavailable measurement, not synthetic success.
        </Text>
      </Page>
    </Document>
  );
}