import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

// Register fonts for better typography
// Font.register({
//   family: "Roboto",
//   src: "https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxP.ttf",
// });

// Certificate styles
const styles = StyleSheet.create({
  page: {
    padding: 60,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
  },
  border: {
    border: "4pt solid #1e40af",
    borderRadius: 8,
    padding: 40,
    height: "100%",
  },
  innerBorder: {
    border: "1pt solid #93c5fd",
    borderRadius: 4,
    padding: 30,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  header: {
    textAlign: "center",
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 15,
    alignSelf: "center",
  },
  organizationName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 5,
  },
  certificateTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginTop: 10,
    marginBottom: 5,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 30,
  },
  body: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },
  presentsText: {
    fontSize: 16,
    color: "#475569",
    marginBottom: 15,
  },
  memberName: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 10,
    borderBottom: "2pt solid #1e40af",
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  memberNumber: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 25,
  },
  completionText: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 8,
    lineHeight: 1.6,
  },
  courseName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e40af",
    marginTop: 5,
    marginBottom: 5,
  },
  courseDetails: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 15,
  },
  certificationBadge: {
    backgroundColor: "#dbeafe",
    borderRadius: 20,
    padding: "8 20",
    marginTop: 10,
    marginBottom: 20,
  },
  certificationName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e40af",
  },
  footer: {
    marginTop: 30,
  },
  signaturesRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  signatureBlock: {
    width: "40%",
    textAlign: "center",
  },
  signatureLine: {
    borderTop: "1pt solid #94a3b8",
    marginBottom: 5,
    paddingTop: 5,
  },
  signatureName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  signatureTitle: {
    fontSize: 10,
    color: "#64748b",
  },
  metadata: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 15,
    borderTop: "1pt solid #e2e8f0",
  },
  metadataItem: {
    fontSize: 9,
    color: "#94a3b8",
  },
  clcBadge: {
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "#10b981",
    color: "#ffffff",
    padding: "5 10",
    borderRadius: 4,
    fontSize: 9,
    fontWeight: "bold",
  },
  watermark: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-45deg)",
    fontSize: 80,
    color: "#f1f5f9",
    opacity: 0.3,
    fontWeight: "bold",
  },
});

interface CertificateTemplateProps {
  // Organization details
  organizationName: string;
  organizationLogo?: string;

  // Member details
  memberName: string;
  memberNumber: string;

  // Course details
  courseName: string;
  courseCode?: string;
  courseHours?: number;
  courseDuration?: string;

  // Certification details
  certificationName?: string;
  certificateNumber: string;
  issueDate: Date;
  expiryDate?: Date;
  completionDate: Date;

  // CLC approval
  clcApproved?: boolean;
  clcCourseCode?: string;

  // Signatures
  issuedBy?: string;
  issuedByTitle?: string;
  approvedBy?: string;
  approvedByTitle?: string;

  // Additional metadata
  sessionCode?: string;
  instructorName?: string;
  verificationUrl?: string;
}

export const CertificateTemplate: React.FC<CertificateTemplateProps> = ({
  organizationName,
  organizationLogo,
  memberName,
  memberNumber,
  courseName,
  courseCode,
  courseHours,
  courseDuration,
  certificationName,
  certificateNumber,
  issueDate,
  expiryDate,
  completionDate,
  clcApproved = false,
  clcCourseCode,
  issuedBy = "Education Coordinator",
  issuedByTitle = "Education & Training Director",
  approvedBy = "President",
  approvedByTitle = "Union President",
  sessionCode,
  instructorName,
  verificationUrl,
}) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.border}>
          <View style={styles.innerBorder}>
            {/* CLC Badge (if approved) */}
            {clcApproved && (
              <View style={styles.clcBadge}>
                <Text>CLC APPROVED</Text>
              </View>
            )}

            {/* Watermark */}
            <View style={styles.watermark}>
              <Text>CERTIFIED</Text>
            </View>

            {/* Header */}
            <View style={styles.header}>
              {organizationLogo && (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image style={styles.logo} src={organizationLogo} />
              )}
              <Text style={styles.organizationName}>{organizationName}</Text>
              <Text style={styles.certificateTitle}>CERTIFICATE</Text>
              <Text style={styles.subtitle}>OF COMPLETION</Text>
            </View>

            {/* Body */}
            <View style={styles.body}>
              <Text style={styles.presentsText}>This certificate is presented to</Text>
              
              <Text style={styles.memberName}>{memberName}</Text>
              
              <Text style={styles.memberNumber}>Member #{memberNumber}</Text>

              <Text style={styles.completionText}>
                for successfully completing the training course
              </Text>

              <Text style={styles.courseName}>{courseName}</Text>

              {courseCode && (
                <Text style={styles.courseDetails}>
                  Course Code: {courseCode}
                  {clcCourseCode && ` • CLC Code: ${clcCourseCode}`}
                </Text>
              )}

              {(courseHours || courseDuration) && (
                <Text style={styles.courseDetails}>
                  {courseHours && `${courseHours} Hours`}
                  {courseHours && courseDuration && " • "}
                  {courseDuration}
                </Text>
              )}

              {certificationName && (
                <View style={styles.certificationBadge}>
                  <Text style={styles.certificationName}>
                    ✓ {certificationName}
                  </Text>
                </View>
              )}

              <Text style={styles.completionText}>
                Completed on {formatDate(completionDate)}
              </Text>

              {instructorName && (
                <Text style={styles.courseDetails}>
                  Instructor: {instructorName}
                </Text>
              )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.signaturesRow}>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine}>
                    <Text style={styles.signatureName}>{issuedBy}</Text>
                    <Text style={styles.signatureTitle}>{issuedByTitle}</Text>
                  </View>
                </View>

                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine}>
                    <Text style={styles.signatureName}>{approvedBy}</Text>
                    <Text style={styles.signatureTitle}>{approvedByTitle}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.metadata}>
                <Text style={styles.metadataItem}>
                  Certificate No: {certificateNumber}
                </Text>
                <Text style={styles.metadataItem}>
                  Issue Date: {formatDate(issueDate)}
                </Text>
                {expiryDate && (
                  <Text style={styles.metadataItem}>
                    Valid Until: {formatDate(expiryDate)}
                  </Text>
                )}
                {sessionCode && (
                  <Text style={styles.metadataItem}>
                    Session: {sessionCode}
                  </Text>
                )}
              </View>

              {verificationUrl && (
                <View style={{ marginTop: 10, textAlign: "center" }}>
                  <Text style={styles.metadataItem}>
                    Verify at: {verificationUrl}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// Helper function to generate certificate PDF blob
export async function generateCertificatePDF(
  props: CertificateTemplateProps
): Promise<Blob> {
  const { pdf } = await import("@react-pdf/renderer");
  const blob = await pdf(<CertificateTemplate {...props} />).toBlob();
  return blob;
}

// Helper function to generate certificate with default union styling
export function createUnionCertificate(
  data: Partial<CertificateTemplateProps> & {
    memberName: string;
    memberNumber: string;
    courseName: string;
    certificateNumber: string;
    issueDate: Date;
    completionDate: Date;
  }
): CertificateTemplateProps {
  return {
    organizationName: data.organizationName || "Union Local",
    memberName: data.memberName,
    memberNumber: data.memberNumber,
    courseName: data.courseName,
    courseCode: data.courseCode,
    courseHours: data.courseHours,
    courseDuration: data.courseDuration,
    certificationName: data.certificationName,
    certificateNumber: data.certificateNumber,
    issueDate: data.issueDate,
    expiryDate: data.expiryDate,
    completionDate: data.completionDate,
    clcApproved: data.clcApproved || false,
    clcCourseCode: data.clcCourseCode,
    issuedBy: data.issuedBy || "Education Coordinator",
    issuedByTitle: data.issuedByTitle || "Education & Training Director",
    approvedBy: data.approvedBy || "President",
    approvedByTitle: data.approvedByTitle || "Union President",
    sessionCode: data.sessionCode,
    instructorName: data.instructorName,
    verificationUrl: data.verificationUrl,
    organizationLogo: data.organizationLogo,
  };
}

