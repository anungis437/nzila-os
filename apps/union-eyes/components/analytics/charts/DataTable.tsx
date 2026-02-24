/**
 * Data Table Component
 * 
 * Advanced data table with sorting, filtering, pagination, and export
 * Fully responsive with column management
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, Download, Eye } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (value: any, row: any) => React.ReactNode;
  width?: string;
}

export interface DataTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  columns: Column[];
  title?: string;
  pageSize?: number;
  searchable?: boolean;
  exportable?: boolean;
  selectable?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRowSelect?: (selectedRows: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onExport?: (data: any[]) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DataTable({
  data,
  columns,
  title,
  pageSize = 10,
  searchable = true,
  exportable = true,
  selectable = false,
  onRowSelect,
  onExport,
}: DataTableProps) {
  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map(col => col.key))
  );
  const [showColumnManager, setShowColumnManager] = useState(false);

  // Filter data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchTerm) {
      result = result.filter(row =>
        columns.some(col => {
          const value = row[col.key];
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([key, filterValue]) => {
      if (filterValue) {
        result = result.filter(row =>
          row[key]?.toString().toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });

    return result;
  }, [data, columns, searchTerm, columnFilters]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Handlers
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(paginatedData.map((_, index) => (currentPage - 1) * pageSize + index)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (index: number, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(index);
    } else {
      newSelected.delete(index);
    }
    setSelectedRows(newSelected);
    onRowSelect?.(Array.from(newSelected).map(i => sortedData[i]));
  };

  const handleExport = () => {
    const exportData = selectedRows.size > 0
      ? Array.from(selectedRows).map(i => sortedData[i])
      : sortedData;
    
    if (onExport) {
      onExport(exportData);
    } else {
      // Default CSV export
      const csv = [
        columns.filter(col => visibleColumns.has(col.key)).map(col => col.label).join(','),
        ...exportData.map(row =>
          columns
            .filter(col => visibleColumns.has(col.key))
            .map(col => `"${row[col.key] || ''}"`)
            .join(',')
        ),
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'export.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const toggleColumnVisibility = (columnKey: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnKey)) {
      newVisible.delete(columnKey);
    } else {
      newVisible.add(columnKey);
    }
    setVisibleColumns(newVisible);
  };

  const visibleColumnsList = columns.filter(col => visibleColumns.has(col.key));

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          <p className="text-sm text-gray-600">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
            {selectedRows.size > 0 && ` (${selectedRows.size} selected)`}
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Column Manager */}
          <div className="relative">
            <button
              onClick={() => setShowColumnManager(!showColumnManager)}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Eye size={16} />
              Columns
            </button>
            {showColumnManager && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10 p-2">
                {columns.map(col => (
                  <label key={col.key} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumnVisibility(col.key)}
                      className="rounded"
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export */}
          {exportable && (
            <button
              onClick={handleExport}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Download size={16} />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {searchable && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search across all columns..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {selectable && (
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                )}
                {visibleColumnsList.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-700"
                    style={{ width: col.width }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{col.label}</span>
                      {col.sortable !== false && (
                        <button
                          onClick={() => handleSort(col.key)}
                          className="hover:bg-gray-200 p-1 rounded"
                        >
                          {sortKey === col.key ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )
                          ) : (
                            <ChevronDown size={14} className="opacity-30" />
                          )}
                        </button>
                      )}
                      {col.filterable && (
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters[col.key] || ''}
                          onChange={(e) => {
                            setColumnFilters({ ...columnFilters, [col.key]: e.target.value });
                            setCurrentPage(1);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="ml-2 px-2 py-1 text-xs border rounded w-24"
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, rowIndex) => {
                const globalIndex = (currentPage - 1) * pageSize + rowIndex;
                const isSelected = selectedRows.has(globalIndex);
                
                return (
                  <tr
                    key={globalIndex}
                    className={`border-t hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(globalIndex, e.target.checked)}
                          className="rounded"
                        />
                      </td>
                    )}
                    {visibleColumnsList.map(col => (
                      <td key={col.key} className="px-4 py-3 text-sm">
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          
          <div className="flex gap-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 border rounded-lg ${
                    currentPage === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default DataTable;

