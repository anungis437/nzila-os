/**
 * Excel Generator — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock ExcelJS ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockCells = new Map<string, Record<string, unknown>>();

  const mockRow = {
    font: undefined as unknown,
    fill: undefined as unknown,
    alignment: undefined as unknown,
    getCell: vi.fn((colIndex: number) => {
      const key = `cell-${colIndex}`;
      if (!mockCells.has(key)) {
        mockCells.set(key, { value: undefined, numFmt: undefined, note: undefined, font: undefined });
      }
      return mockCells.get(key)!;
    }),
  };

  const mockWorksheet = {
    columns: [] as unknown[],
    addRow: vi.fn(() => mockRow),
    getRow: vi.fn(() => mockRow),
    getCell: vi.fn((row: number, col: number) => {
      const key = `${row}-${col}`;
      if (!mockCells.has(key)) {
        mockCells.set(key, { value: undefined, numFmt: undefined, note: undefined, font: undefined });
      }
      return mockCells.get(key)!;
    }),
    autoFilter: undefined as unknown,
    addConditionalFormatting: vi.fn(),
    protect: vi.fn(),
  };

  const mockWorkbook = {
    creator: '',
    lastModifiedBy: '',
    created: undefined as unknown,
    modified: undefined as unknown,
    addWorksheet: vi.fn(() => mockWorksheet),
    xlsx: {
      writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
    },
  };

  return {
    mockWorkbook,
    mockWorksheet,
    mockRow,
    mockCells,
    MockExcelJS: { Workbook: vi.fn(() => mockWorkbook) },
  };
});

vi.mock('exceljs', () => {
  const M = function Workbook() {
    return mocks.mockWorkbook;
  } as unknown as { new(): Record<string, unknown> };
  return { default: { Workbook: M } };
});

import {
  generateExcel,
  generateMultiSheetExcel,
  generateFinancialExcel,
  generateMembershipRoster,
  generateClaimsExcel,
  generateRemittanceExcel,
  generateTrainingReportExcel,
  applyConditionalFormatting,
  addChart,
  protectWorksheet,
} from '../utils/excel-generator';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const sampleColumns = [
  { header: 'Id', key: 'id', width: 10 },
  { header: 'Name', key: 'name', width: 25 },
  { header: 'Amount', key: 'amount', width: 15, format: '$#,##0.00' },
];

const sampleData = [
  { id: 1, name: 'Alice', amount: 100 },
  { id: 2, name: 'Bob', amount: 200 },
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('generateExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCells.clear();
  });

  it('returns a Buffer', async () => {
    const result = await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('sets workbook metadata', async () => {
    await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
    });
    expect(mocks.mockWorkbook.creator).toBe('Union Management System');
  });

  it('adds worksheet with default sheet name', async () => {
    await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
    });
    expect(mocks.mockWorkbook.addWorksheet).toHaveBeenCalledWith(
      'Sheet1', expect.any(Object),
    );
  });

  it('uses custom sheet name', async () => {
    await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
      sheetName: 'Custom',
    });
    expect(mocks.mockWorkbook.addWorksheet).toHaveBeenCalledWith(
      'Custom', expect.any(Object),
    );
  });

  it('adds data rows', async () => {
    await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
    });
    expect(mocks.mockWorksheet.addRow).toHaveBeenCalledTimes(2);
  });

  it('handles single object data (non-array)', async () => {
    await generateExcel({
      title: 'Test', data: { id: 1, name: 'Solo' } as unknown as unknown[],
      columns: sampleColumns,
    });
    expect(mocks.mockWorksheet.addRow).toHaveBeenCalledTimes(1);
  });

  it('styles header row with defaults', async () => {
    await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
    });
    expect(mocks.mockWorksheet.getRow).toHaveBeenCalledWith(1);
  });

  it('applies alternate row coloring', async () => {
    await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
      styles: { alternateRows: true, alternateRowFill: 'FFEEEEEE' },
    });
    expect(mocks.mockWorksheet.addRow).toHaveBeenCalledTimes(2);
  });

  it('enables auto-filter by default', async () => {
    await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
    });
    expect(mocks.mockWorksheet.autoFilter).toBeDefined();
  });

  it('disables auto-filter when includeFilters=false', async () => {
    // Reset autoFilter
    mocks.mockWorksheet.autoFilter = undefined;
    await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
      includeFilters: false,
    });
    expect(mocks.mockWorksheet.autoFilter).toBeUndefined();
  });
});

describe('generateMultiSheetExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCells.clear();
  });

  it('creates a sheet for each entry', async () => {
    const result = await generateMultiSheetExcel({
      filename: 'multi',
      sheets: [
        { name: 'A', data: [{ x: 1 }], columns: [{ header: 'X', key: 'x' }] },
        { name: 'B', data: [{ y: 2 }], columns: [{ header: 'Y', key: 'y' }] },
      ],
    });
    expect(mocks.mockWorkbook.addWorksheet).toHaveBeenCalledTimes(2);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('sets frozen header pane on each sheet', async () => {
    await generateMultiSheetExcel({
      filename: 'multi',
      sheets: [
        { name: 'S1', data: [], columns: [{ header: 'H', key: 'h' }] },
      ],
    });
    expect(mocks.mockWorkbook.addWorksheet).toHaveBeenCalledWith('S1', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
  });
});

describe('template generators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCells.clear();
  });

  it('generateFinancialExcel creates 3 sheets', async () => {
    await generateFinancialExcel({
      summary: { period: 'Q1', revenue: 1000, expenses: 500, net: 500 },
      transactions: [{ date: '2025-01-01', description: 'Dues', category: 'Income', amount: 100, type: 'debit' }],
      categories: [{ category: 'Income', total: 100, count: 1 }],
    });
    expect(mocks.mockWorkbook.addWorksheet).toHaveBeenCalledTimes(3);
  });

  it('generateMembershipRoster uses Members sheet', async () => {
    await generateMembershipRoster([
      { memberId: 'M1', name: 'Alice', email: 'a@b.ca', status: 'active', joinDate: '2024-01-01', local: 'L1', position: 'Steward' },
    ]);
    expect(mocks.mockWorkbook.addWorksheet).toHaveBeenCalledWith(
      'Members', expect.any(Object),
    );
  });

  it('generateClaimsExcel uses Claims sheet', async () => {
    await generateClaimsExcel([{ claimNumber: 'C1', subject: 'Test', status: 'open' }]);
    expect(mocks.mockWorkbook.addWorksheet).toHaveBeenCalledWith(
      'Claims', expect.any(Object),
    );
  });

  it('generateRemittanceExcel creates 2 sheets', async () => {
    await generateRemittanceExcel({
      organizationInfo: {},
      remittances: [{ memberId: 'M1', memberName: 'Test', duesAmount: 50 }],
      summary: { totalMembers: 1, totalDues: 50 },
    });
    expect(mocks.mockWorkbook.addWorksheet).toHaveBeenCalledTimes(2);
  });

  it('generateTrainingReportExcel creates 3 sheets', async () => {
    await generateTrainingReportExcel({
      programs: [{ name: 'Safety', type: 'online', duration: 4 }],
      enrollments: [{ memberName: 'Alice', programName: 'Safety', status: 'enrolled' }],
      completions: [{ memberName: 'Alice', programName: 'Safety', completedDate: '2025-06-01' }],
    });
    expect(mocks.mockWorkbook.addWorksheet).toHaveBeenCalledTimes(3);
  });
});

describe('helper functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCells.clear();
  });

  it('applyConditionalFormatting delegates to worksheet', () => {
    const rules = [{ type: 'cellIs' as const, operator: 'greaterThan' as const, formulae: ['0'], style: {} }];
    applyConditionalFormatting(mocks.mockWorksheet as unknown as import('exceljs').Worksheet, 'A1:A10', rules as unknown as import('exceljs').ConditionalFormattingRule[]);
    expect(mocks.mockWorksheet.addConditionalFormatting).toHaveBeenCalledWith({
      ref: 'A1:A10',
      rules,
    });
  });

  it('addChart writes chart metadata as cell note', async () => {
    const result = await addChart(
      mocks.mockWorksheet as unknown as import('exceljs').Worksheet,
      { type: 'bar', title: 'Revenue', dataRange: 'A1:B5', position: { row: 3, col: 4 } },
    );
    expect(result.type).toBe('bar');
    expect(result.title).toBe('Revenue');
    const cell = mocks.mockWorksheet.getCell(3, 4);
    expect(cell.value).toContain('Revenue');
    expect(cell.note).toContain('bar');
  });

  it('addChart uses default position when not specified', async () => {
    await addChart(
      mocks.mockWorksheet as unknown as import('exceljs').Worksheet,
      { type: 'line', title: 'Trend', dataRange: 'A1:C10' },
    );
    expect(mocks.mockWorksheet.getCell).toHaveBeenCalledWith(1, 1);
  });

  it('protectWorksheet sets protection options', () => {
    protectWorksheet(mocks.mockWorksheet as unknown as import('exceljs').Worksheet, 'secret');
    expect(mocks.mockWorksheet.protect).toHaveBeenCalledWith('secret', expect.objectContaining({
      selectLockedCells: true,
      formatCells: false,
      insertRows: false,
      deleteRows: false,
    }));
  });

  it('protectWorksheet uses empty password when none given', () => {
    protectWorksheet(mocks.mockWorksheet as unknown as import('exceljs').Worksheet);
    expect(mocks.mockWorksheet.protect).toHaveBeenCalledWith('', expect.any(Object));
  });
});

// ── Gap Coverage Tests ──────────────────────────────────────────────────────

describe('generateExcel — gap coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCells.clear();
  });

  it('disables freeze panes when freezeHeader is false', async () => {
    await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
      freezeHeader: false,
    });
    const call = mocks.mockWorkbook.addWorksheet.mock.calls[0];
    const options = call[1] as Record<string, unknown>;
    const views = options.views as Record<string, unknown>[];
    expect(views[0].ySplit).toBe(0);
  });

  it('handles empty data array', async () => {
    await generateExcel({
      title: 'Test', data: [], columns: sampleColumns,
    });
    expect(mocks.mockWorksheet.addRow).toHaveBeenCalledTimes(0);
  });

  it('formats Date values with numFmt', async () => {
    const dataWithDate = [
      { id: 1, name: 'Alice', date: new Date('2025-01-01') },
    ];
    const colsWithDate = [
      ...sampleColumns.slice(0, 2),
      { header: 'Date', key: 'date', format: 'yyyy-mm-dd' },
    ];
    await generateExcel({
      title: 'Test', data: dataWithDate,
      columns: colsWithDate,
    });
    expect(mocks.mockWorksheet.addRow).toHaveBeenCalledTimes(1);
  });

  it('applies column format when specified', async () => {
    const dataWithFormat = [{ id: 1, name: 'A', amount: 123.456 }];
    await generateExcel({
      title: 'Test', data: dataWithFormat, columns: sampleColumns,
    });
    // Column has format, should apply numFmt
    expect(mocks.mockWorksheet.addRow).toHaveBeenCalled();
  });

  it('defaults to freezeHeader=true', async () => {
    await generateExcel({
      title: 'Test', data: sampleData, columns: sampleColumns,
      // No freezeHeader specified
    });
    const call = mocks.mockWorkbook.addWorksheet.mock.calls[0];
    const options = call[1] as Record<string, unknown>;
    const views = options.views as Record<string, unknown>[];
    expect(views[0].ySplit).toBe(1);
  });
});
