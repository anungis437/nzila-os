import PDFDocument from 'pdfkit';

export async function renderOrganizingFormPdf(input: {
  title: string;
  templateVersion: number;
  jurisdiction: string;
  sourceUri: string;
  fields: Array<{ label: string; value: string }>;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 54, bottom: 54, left: 54, right: 54 }, info: { Title: input.title } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.fontSize(18).text(input.title, { align: 'center' }).moveDown();
    doc.fontSize(9).fillColor('#444444').text(`Jurisdiction: ${input.jurisdiction}`);
    doc.text(`Reviewed template version: ${input.templateVersion}`);
    doc.text(`Source: ${input.sourceUri}`).moveDown();
    doc.fillColor('#000000').fontSize(11);
    for (const field of input.fields) {
      doc.font('Helvetica-Bold').text(`${field.label}:`, { continued: true });
      doc.font('Helvetica').text(` ${field.value || '—'}`).moveDown(0.5);
    }
    doc.moveDown().fontSize(8).fillColor('#555555').text('Generated from the organization-scoped campaign record. Verify the completed form before filing.');
    doc.end();
  });
}
