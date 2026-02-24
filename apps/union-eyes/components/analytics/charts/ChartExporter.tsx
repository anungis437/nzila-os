/**
 * Chart Exporter Component
 * 
 * Export charts to various formats (PNG, SVG, PDF)
 * Supports single and batch exports
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React, { useState } from 'react';
import { Download, FileImage, FileCode, FileText, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ExportOptions {
  format: 'png' | 'svg' | 'pdf';
  width?: number;
  height?: number;
  quality?: number;
  filename?: string;
}

export interface ChartExporterProps {
  chartRef: React.RefObject<HTMLElement>;
  defaultFilename?: string;
  onExport?: (format: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ChartExporter({
  chartRef,
  defaultFilename = 'chart',
  onExport,
}: ChartExporterProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [_exportFormat, _setExportFormat] = useState<'png' | 'svg' | 'pdf'>('png');
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: 'png',
    width: 1200,
    height: 800,
    quality: 0.95,
    filename: defaultFilename,
  });

  // Export to PNG using html2canvas
  const exportToPNG = async () => {
    if (!chartRef.current) return;

    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `${options.filename}.png`;
      link.href = canvas.toDataURL('image/png', options.quality);
      link.click();
    } catch (_error) {
alert('Failed to export as PNG. Please try again.');
    }
  };

  // Export to SVG
  const exportToSVG = async () => {
    if (!chartRef.current) return;

    try {
      const svgElement = chartRef.current.querySelector('svg');
      if (!svgElement) {
        throw new Error('No SVG element found');
      }

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.download = `${options.filename}.svg`;
      link.href = url;
      link.click();

      URL.revokeObjectURL(url);
    } catch (_error) {
alert('Failed to export as SVG. Please try again.');
    }
  };

  // Export to PDF using jsPDF
  const exportToPDF = async () => {
    if (!chartRef.current) return;

    try {
      // Dynamically import jsPDF and html2canvas
      const { default: jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: options.width! > options.height! ? 'landscape' : 'portrait',
        unit: 'px',
        format: [options.width!, options.height!],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, options.width!, options.height!);
      pdf.save(`${options.filename}.pdf`);
    } catch (_error) {
alert('Failed to export as PDF. Please try again.');
    }
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    onExport?.(options.format);

    try {
      switch (options.format) {
        case 'png':
          await exportToPNG();
          break;
        case 'svg':
          await exportToSVG();
          break;
        case 'pdf':
          await exportToPDF();
          break;
      }
    } finally {
      setIsExporting(false);
      setShowOptions(false);
    }
  };

  return (
    <div className="relative">
      {/* Export Button */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExporting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download size={16} />
            Export Chart
          </>
        )}
      </button>

      {/* Export Options Panel */}
      {showOptions && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-10 p-4">
          <h4 className="font-semibold mb-4">Export Options</h4>

          {/* Format Selection */}
          <div className="space-y-3 mb-4">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="format"
                value="png"
                checked={options.format === 'png'}
                onChange={(e) => setOptions({ ...options, format: e.target.value as 'png' })}
                className="w-4 h-4"
              />
              <FileImage size={20} className="text-blue-600" />
              <div className="flex-1">
                <div className="font-medium">PNG</div>
                <div className="text-xs text-gray-600">Raster image, best for sharing</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="format"
                value="svg"
                checked={options.format === 'svg'}
                onChange={(e) => setOptions({ ...options, format: e.target.value as 'svg' })}
                className="w-4 h-4"
              />
              <FileCode size={20} className="text-green-600" />
              <div className="flex-1">
                <div className="font-medium">SVG</div>
                <div className="text-xs text-gray-600">Vector image, best for editing</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={options.format === 'pdf'}
                onChange={(e) => setOptions({ ...options, format: e.target.value as 'pdf' })}
                className="w-4 h-4"
              />
              <FileText size={20} className="text-red-600" />
              <div className="flex-1">
                <div className="font-medium">PDF</div>
                <div className="text-xs text-gray-600">Document format, best for reports</div>
              </div>
            </label>
          </div>

          {/* Filename */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Filename</label>
            <input
              type="text"
              value={options.filename}
              onChange={(e) => setOptions({ ...options, filename: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Enter filename"
            />
          </div>

          {/* Dimensions (for PNG and PDF) */}
          {(options.format === 'png' || options.format === 'pdf') && (
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Width (px)</label>
                <input
                  type="number"
                  value={options.width}
                  onChange={(e) => setOptions({ ...options, width: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="100"
                  max="4000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Height (px)</label>
                <input
                  type="number"
                  value={options.height}
                  onChange={(e) => setOptions({ ...options, height: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="100"
                  max="4000"
                />
              </div>
            </div>
          )}

          {/* Quality (for PNG) */}
          {options.format === 'png' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Quality: {Math.round(options.quality! * 100)}%
              </label>
              <input
                type="range"
                value={options.quality}
                onChange={(e) => setOptions({ ...options, quality: parseFloat(e.target.value) })}
                className="w-full"
                min="0.1"
                max="1"
                step="0.05"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
            <button
              onClick={() => setShowOptions(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChartExporter;

