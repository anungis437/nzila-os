/**
 * ARTIFACT TYPE: PDF Generation Service
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * Leadership Briefing Report — PDF Generation Entry Point
 *
 * Renders PdfReportData to a PDF buffer using @react-pdf/renderer.
 * Must run in Node.js runtime (not edge).
 */

import React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement, JSXElementConstructor } from 'react';
import { ExecutiveContinuityBriefTemplate } from './ExecutiveContinuityBriefTemplate';
import type { PdfReportData } from './reportDataMapper';

/**
 * Renders an Leadership Briefing Report to a PDF Buffer.
 *
 * @param data Fully-assembled report data from mapToPdfReportData()
 * @returns Buffer suitable for streaming as application/pdf
 */
export async function generateExecutiveContinuityPdf(data: PdfReportData): Promise<Buffer> {
  const element = React.createElement(
    ExecutiveContinuityBriefTemplate,
    { data },
  ) as ReactElement<DocumentProps, string | JSXElementConstructor<any>>;
  return renderToBuffer(element);
}
