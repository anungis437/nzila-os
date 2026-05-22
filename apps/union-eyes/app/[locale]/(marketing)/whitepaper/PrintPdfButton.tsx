'use client';

import { Download } from 'lucide-react';
import { useCallback, useState } from 'react';

interface PrintPdfButtonProps {
  label: string;
  className?: string;
  documentTitle?: string;
  filename?: string;
}

async function waitForAllImagesReady(scope: ParentNode, timeoutMs = 3500): Promise<void> {
  const imgs = Array.from(scope.querySelectorAll('img'));
  const pending = imgs
    .filter((img) => !img.complete || img.naturalWidth === 0)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    );
  if (pending.length === 0) return;
  await Promise.race([
    Promise.all(pending).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Captures the rendered whitepaper page on the client and saves it as a
 * professional PDF file with no browser print headers/footers or URL stamps.
 * Uses html2canvas-pro to rasterize each section bucket and jspdf to assemble
 * multi-page A4 output, paginating at major-section boundaries when possible.
 */
export function PrintPdfButton({
  label,
  className,
  documentTitle: _documentTitle,
  filename = 'The-Continuity-Gap-Whitepaper.pdf',
}: PrintPdfButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false);

  const handleDownload = useCallback(async () => {
    if (typeof window === 'undefined' || isPreparing) return;

    const root = document.querySelector<HTMLElement>('.whitepaper-print-root');
    if (!root) return;

    setIsPreparing(true);
    root.classList.add('pdf-capture');
    // Force any lazy <img> to load and ensure decoded bitmaps before capture.
    root.querySelectorAll('img').forEach((img) => {
      img.setAttribute('loading', 'eager');
      if (!img.hasAttribute('crossorigin')) {
        img.setAttribute('crossorigin', 'anonymous');
      }
    });

    try {
      await waitForAllImagesReady(root);
      // Yield a frame so layout settles after pdf-capture class is applied.
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);

      // A4 in mm
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const marginMm = 12;
      const contentWidthMm = pageWidthMm - marginMm * 2;
      const contentHeightMm = pageHeightMm - marginMm * 2;

      // Capture each major section (and the page hero) separately so a section
      // never gets split mid-content across pages.
      const captureTargets: HTMLElement[] = [];
      const hero = root.querySelector<HTMLElement>(':scope > section');
      if (hero) captureTargets.push(hero);
      root
        .querySelectorAll<HTMLElement>('[data-major-section]')
        .forEach((el) => captureTargets.push(el));

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      let pageIndex = 0;

      for (const target of captureTargets) {
        // eslint-disable-next-line no-await-in-loop
        const canvas = await html2canvas(target, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: Math.max(root.scrollWidth, 1024),
        });

        const pxPerMm = canvas.width / contentWidthMm;
        const sliceHeightPx = Math.floor(contentHeightMm * pxPerMm);
        let offsetPx = 0;

        while (offsetPx < canvas.height) {
          const sliceHeight = Math.min(sliceHeightPx, canvas.height - offsetPx);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceHeight;
          const ctx = sliceCanvas.getContext('2d');
          if (!ctx) break;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            offsetPx,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight,
          );

          if (pageIndex > 0) pdf.addPage();
          const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
          const sliceHeightMm = sliceHeight / pxPerMm;
          pdf.addImage(
            imgData,
            'JPEG',
            marginMm,
            marginMm,
            contentWidthMm,
            sliceHeightMm,
            undefined,
            'FAST',
          );

          offsetPx += sliceHeight;
          pageIndex += 1;
        }
      }

      pdf.save(filename);
    } catch (err) {
      console.error('PDF generation failed', err);
      // Fallback: use the browser's print dialog if capture fails entirely.
      window.print();
    } finally {
      root.classList.remove('pdf-capture');
      setIsPreparing(false);
    }
  }, [filename, isPreparing]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isPreparing}
      className={
        className ??
        'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-wait disabled:opacity-70'
      }
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {isPreparing ? 'Preparing PDF…' : label}
    </button>
  );
}
