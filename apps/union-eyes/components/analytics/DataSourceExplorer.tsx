/**
 * Data Source Explorer Component
 * 
 * Browse available data sources with field preview and relationship visualization
 * Supports drag-drop field selection and sample data preview
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.2 - Report Builder UI Enhancement
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Database,
  Table as _TableIcon,
  Search,
  ChevronRight,
  ChevronDown,
  Link2,
  Eye,
  Info,
  Users,
  FileText,
  Clock,
  DollarSign,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

export interface DataSourceField {
  fieldId: string;
  fieldName: string;
  type: string;
  aggregatable: boolean;
  filterable: boolean;
  sortable: boolean;
  aggregations?: string[];
  description?: string;
}

export interface DataSource {
  id: string;
  name: string;
  description: string;
  icon?: string;
  fields: DataSourceField[];
  joinable?: string[];
}

interface DataSourceExplorerProps {
  dataSources: DataSource[];
  selectedSource?: string;
  onSourceSelect: (sourceId: string) => void;
  onFieldSelect: (field: DataSourceField, aggregation?: string) => void;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getDataSourceIcon = (icon?: string) => {
  switch (icon) {
    case 'FileText':
      return <FileText className="w-5 h-5" />;
    case 'Users':
      return <Users className="w-5 h-5" />;
    case 'Clock':
      return <Clock className="w-5 h-5" />;
    case 'DollarSign':
      return <DollarSign className="w-5 h-5" />;
    default:
      return <Database className="w-5 h-5" />;
  }
};

const getFieldTypeColor = (type: string): string => {
  switch (type) {
    case 'string':
    case 'text':
      return 'bg-blue-100 text-blue-800';
    case 'number':
    case 'integer':
    case 'decimal':
      return 'bg-green-100 text-green-800';
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'bg-purple-100 text-purple-800';
    case 'boolean':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getFieldTypeIcon = (type: string): string => {
  switch (type) {
    case 'string':
    case 'text':
      return 'Aa';
    case 'number':
    case 'integer':
    case 'decimal':
      return '123';
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'ðŸ“…';
    case 'boolean':
      return 'âœ“/âœ—';
    default:
      return '?';
  }
};

// ============================================================================
// Component
// ============================================================================

export function DataSourceExplorer({
  dataSources,
  selectedSource,
  onSourceSelect,
  onFieldSelect,
  className,
}: DataSourceExplorerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSources, setExpandedSources] = useState<string[]>([]);
  const [previewField, setPreviewField] = useState<DataSourceField | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sampleData, setSampleData] = useState<any[]>([]);

  // Auto-expand selected source
  useEffect(() => {
    if (selectedSource && !expandedSources.includes(selectedSource)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedSources([...expandedSources, selectedSource]);
    }
  }, [selectedSource, expandedSources]);

  // Filter data sources by search
  const filteredSources = dataSources.filter(
    (source) =>
      source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.fields.some((field) =>
        field.fieldName.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  // Toggle source expansion
  const toggleSourceExpansion = (sourceId: string) => {
    if (expandedSources.includes(sourceId)) {
      setExpandedSources(expandedSources.filter((id) => id !== sourceId));
    } else {
      setExpandedSources([...expandedSources, sourceId]);
    }
  };

  // Handle field preview
  const handleFieldPreview = async (sourceId: string, field: DataSourceField) => {
    setPreviewField(field);
    setSampleData([]);

    try {
      const response = await fetch(
        `/api/reports/datasources/sample?sourceId=${encodeURIComponent(sourceId)}&fieldId=${encodeURIComponent(field.fieldId)}`
      );

      if (response.ok) {
        const result = await response.json();
        setSampleData(Array.isArray(result.samples) ? result.samples : []);
      } else {
        setSampleData([]);
      }
    } catch (_error) {
setSampleData([]);
    }
  };

  // Handle field drag start
  const handleDragStart = (e: React.DragEvent, field: DataSourceField) => {
    e.dataTransfer.setData('field', JSON.stringify(field));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Data Sources
        </h3>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search data sources and fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Data Sources List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {filteredSources.map((source) => {
            const isExpanded = expandedSources.includes(source.id);
            const isSelected = selectedSource === source.id;

            return (
              <Card
                key={source.id}
                className={`overflow-hidden transition-all ${
                  isSelected ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {/* Source Header */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    onSourceSelect(source.id);
                    toggleSourceExpansion(source.id);
                  }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-blue-600">
                      {getDataSourceIcon(source.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{source.name}</h4>
                      <p className="text-xs text-gray-500 truncate">
                        {source.description}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {source.fields.length} fields
                    </Badge>
                  </div>
                  <div className="ml-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Joinable Relationships */}
                {isExpanded && source.joinable && source.joinable.length > 0 && (
                  <div className="px-3 py-2 bg-blue-50 border-t border-b">
                    <div className="flex items-center gap-2 text-xs text-blue-700">
                      <Link2 className="w-3 h-3" />
                      <span>Can join with:</span>
                      <div className="flex gap-1">
                        {source.joinable.map((join) => (
                          <Badge
                            key={join}
                            variant="outline"
                            className="text-xs bg-white"
                          >
                            {dataSources.find((ds) => ds.id === join)?.name ||
                              join}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fields List */}
                {isExpanded && (
                  <div className="p-3 space-y-1 bg-gray-50">
                    {source.fields.map((field) => (
                      <div
                        key={field.fieldId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, field)}
                        className="flex items-center justify-between p-2 bg-white rounded border hover:border-blue-300 hover:bg-blue-50 cursor-move transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className={`text-xs font-mono px-1.5 py-0.5 rounded ${getFieldTypeColor(
                              field.type
                            )}`}
                          >
                            {getFieldTypeIcon(field.type)}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {field.fieldName}
                          </span>
                          
                          {/* Field capabilities badges */}
                          <div className="flex gap-1 ml-auto">
                            {field.aggregatable && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-green-50 text-green-700 border-green-200"
                                    >
                                      Î£
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Aggregatable: {field.aggregations?.join(', ')}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {field.filterable && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                              >
                                F
                              </Badge>
                            )}
                            {field.sortable && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                              >
                                S
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 ml-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleFieldPreview(source.id, field)}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Preview sample data</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => onFieldSelect(field)}
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Add to report</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {filteredSources.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No data sources found</p>
          </div>
        )}
      </ScrollArea>

      {/* Field Preview Panel */}
      {previewField && (
        <div className="border-t p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Info className="w-4 h-4" />
              Field Preview: {previewField.fieldName}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewField(null)}
            >
              Close
            </Button>
          </div>
          
          <div className="text-xs space-y-1 mb-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <Badge className={getFieldTypeColor(previewField.type)}>
                {previewField.type}
              </Badge>
            </div>
            {previewField.description && (
              <p className="text-gray-600 italic">{previewField.description}</p>
            )}
          </div>

          {sampleData.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2">Sample Values:</p>
              <div className="space-y-1">
                {sampleData.map((item, idx) => (
                  <div
                    key={idx}
                    className="text-xs p-2 bg-white rounded border"
                  >
                    {item.value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

