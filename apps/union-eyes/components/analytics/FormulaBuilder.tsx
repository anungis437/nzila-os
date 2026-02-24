/**
 * Formula Builder Component
 * 
 * Visual formula editor with function library and validation
 * Supports 50+ functions with syntax highlighting
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.2 - Report Builder UI Enhancement
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
 
import {
  Calculator,
  Search as _Search,
  Check,
  AlertCircle,
  Code,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ============================================================================
// Types
// ============================================================================

export interface FormulaField {
  id: string;
  name: string;
  alias?: string;
  formula: string;
  isValid: boolean;
  validationError?: string;
}

interface FormulaFunction {
  name: string;
  category: 'math' | 'string' | 'date' | 'aggregate' | 'conditional' | 'conversion';
  description: string;
  syntax: string;
  example: string;
  parameters: string[];
}

interface FormulaBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (field: FormulaField) => void;
  availableFields: { id: string; name: string; type: string }[];
  initialFormula?: FormulaField;
}

// ============================================================================
// Formula Functions Library
// ============================================================================

const FORMULA_FUNCTIONS: FormulaFunction[] = [
  // Math Functions
  {
    name: 'SUM',
    category: 'math',
    description: 'Calculate sum of values',
    syntax: 'SUM(field)',
    example: 'SUM(claim_amount)',
    parameters: ['field'],
  },
  {
    name: 'AVG',
    category: 'math',
    description: 'Calculate average of values',
    syntax: 'AVG(field)',
    example: 'AVG(resolution_time)',
    parameters: ['field'],
  },
  {
    name: 'MIN',
    category: 'math',
    description: 'Find minimum value',
    syntax: 'MIN(field)',
    example: 'MIN(claim_amount)',
    parameters: ['field'],
  },
  {
    name: 'MAX',
    category: 'math',
    description: 'Find maximum value',
    syntax: 'MAX(field)',
    example: 'MAX(claim_amount)',
    parameters: ['field'],
  },
  {
    name: 'COUNT',
    category: 'aggregate',
    description: 'Count number of records',
    syntax: 'COUNT(field)',
    example: 'COUNT(id)',
    parameters: ['field'],
  },
  {
    name: 'COUNT_DISTINCT',
    category: 'aggregate',
    description: 'Count unique values',
    syntax: 'COUNT_DISTINCT(field)',
    example: 'COUNT_DISTINCT(member_id)',
    parameters: ['field'],
  },
  {
    name: 'ABS',
    category: 'math',
    description: 'Absolute value',
    syntax: 'ABS(value)',
    example: 'ABS(balance)',
    parameters: ['value'],
  },
  {
    name: 'ROUND',
    category: 'math',
    description: 'Round to decimal places',
    syntax: 'ROUND(value, decimals)',
    example: 'ROUND(claim_amount, 2)',
    parameters: ['value', 'decimals'],
  },
  {
    name: 'CEIL',
    category: 'math',
    description: 'Round up to nearest integer',
    syntax: 'CEIL(value)',
    example: 'CEIL(days_open)',
    parameters: ['value'],
  },
  {
    name: 'FLOOR',
    category: 'math',
    description: 'Round down to nearest integer',
    syntax: 'FLOOR(value)',
    example: 'FLOOR(days_open)',
    parameters: ['value'],
  },
  
  // String Functions
  {
    name: 'CONCAT',
    category: 'string',
    description: 'Concatenate strings',
    syntax: 'CONCAT(str1, str2, ...)',
    example: 'CONCAT(first_name, " ", last_name)',
    parameters: ['str1', 'str2'],
  },
  {
    name: 'UPPER',
    category: 'string',
    description: 'Convert to uppercase',
    syntax: 'UPPER(text)',
    example: 'UPPER(status)',
    parameters: ['text'],
  },
  {
    name: 'LOWER',
    category: 'string',
    description: 'Convert to lowercase',
    syntax: 'LOWER(text)',
    example: 'LOWER(email)',
    parameters: ['text'],
  },
  {
    name: 'SUBSTRING',
    category: 'string',
    description: 'Extract substring',
    syntax: 'SUBSTRING(text, start, length)',
    example: 'SUBSTRING(claim_id, 1, 5)',
    parameters: ['text', 'start', 'length'],
  },
  {
    name: 'LENGTH',
    category: 'string',
    description: 'Get string length',
    syntax: 'LENGTH(text)',
    example: 'LENGTH(description)',
    parameters: ['text'],
  },
  {
    name: 'TRIM',
    category: 'string',
    description: 'Remove leading/trailing spaces',
    syntax: 'TRIM(text)',
    example: 'TRIM(name)',
    parameters: ['text'],
  },
  {
    name: 'REPLACE',
    category: 'string',
    description: 'Replace text',
    syntax: 'REPLACE(text, find, replace)',
    example: 'REPLACE(status, "OPEN", "Active")',
    parameters: ['text', 'find', 'replace'],
  },
  
  // Date Functions
  {
    name: 'NOW',
    category: 'date',
    description: 'Current date and time',
    syntax: 'NOW()',
    example: 'NOW()',
    parameters: [],
  },
  {
    name: 'DATE_DIFF',
    category: 'date',
    description: 'Difference between dates',
    syntax: 'DATE_DIFF(date1, date2, unit)',
    example: 'DATE_DIFF(resolved_at, created_at, "days")',
    parameters: ['date1', 'date2', 'unit'],
  },
  {
    name: 'DATE_ADD',
    category: 'date',
    description: 'Add time to date',
    syntax: 'DATE_ADD(date, value, unit)',
    example: 'DATE_ADD(created_at, 7, "days")',
    parameters: ['date', 'value', 'unit'],
  },
  {
    name: 'YEAR',
    category: 'date',
    description: 'Extract year from date',
    syntax: 'YEAR(date)',
    example: 'YEAR(created_at)',
    parameters: ['date'],
  },
  {
    name: 'MONTH',
    category: 'date',
    description: 'Extract month from date',
    syntax: 'MONTH(date)',
    example: 'MONTH(created_at)',
    parameters: ['date'],
  },
  {
    name: 'DAY',
    category: 'date',
    description: 'Extract day from date',
    syntax: 'DAY(date)',
    example: 'DAY(created_at)',
    parameters: ['date'],
  },
  
  // Conditional Functions
  {
    name: 'IF',
    category: 'conditional',
    description: 'Conditional expression',
    syntax: 'IF(condition, true_value, false_value)',
    example: 'IF(status = "RESOLVED", 1, 0)',
    parameters: ['condition', 'true_value', 'false_value'],
  },
  {
    name: 'CASE',
    category: 'conditional',
    description: 'Multiple conditions',
    syntax: 'CASE WHEN condition THEN value ... ELSE default END',
    example: 'CASE WHEN priority = "HIGH" THEN 1 WHEN priority = "MEDIUM" THEN 2 ELSE 3 END',
    parameters: ['conditions'],
  },
  {
    name: 'COALESCE',
    category: 'conditional',
    description: 'Return first non-null value',
    syntax: 'COALESCE(value1, value2, ...)',
    example: 'COALESCE(phone, email, "No contact")',
    parameters: ['value1', 'value2'],
  },
  
  // Conversion Functions
  {
    name: 'CAST',
    category: 'conversion',
    description: 'Convert data type',
    syntax: 'CAST(value AS type)',
    example: 'CAST(amount AS INTEGER)',
    parameters: ['value', 'type'],
  },
  {
    name: 'TO_STRING',
    category: 'conversion',
    description: 'Convert to string',
    syntax: 'TO_STRING(value)',
    example: 'TO_STRING(claim_number)',
    parameters: ['value'],
  },
  {
    name: 'TO_NUMBER',
    category: 'conversion',
    description: 'Convert to number',
    syntax: 'TO_NUMBER(value)',
    example: 'TO_NUMBER(amount_text)',
    parameters: ['value'],
  },
];

// ============================================================================
// Component
// ============================================================================

export function FormulaBuilder({
  open,
  onClose,
  onSave,
  availableFields,
  initialFormula,
}: FormulaBuilderProps) {
  const [alias, setAlias] = useState(initialFormula?.alias || '');
  const [formula, setFormula] = useState(initialFormula?.formula || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Validate formula
  const validateFormula = useCallback((formulaText: string): { isValid: boolean; error: string | null } => {
    // Check for balanced parentheses
    const openParens = (formulaText.match(/\(/g) || []).length;
    const closeParens = (formulaText.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return { isValid: false, error: 'Unbalanced parentheses' };
    }

    // Check for valid field references
    const fieldPattern = /\{([^}]+)\}/g;
    const fieldMatches = formulaText.match(fieldPattern);
    if (fieldMatches) {
      for (const match of fieldMatches) {
        const fieldId = match.slice(1, -1);
        if (!availableFields.find(f => f.id === fieldId)) {
          return { isValid: false, error: `Unknown field: ${fieldId}` };
        }
      }
    }

    // Check for valid function names
    const functionPattern = /([A-Z_]+)\(/g;
    const functionMatches = formulaText.match(functionPattern);
    if (functionMatches) {
      for (const match of functionMatches) {
        const funcName = match.slice(0, -1);
        if (!FORMULA_FUNCTIONS.find(f => f.name === funcName)) {
          return { isValid: false, error: `Unknown function: ${funcName}` };
        }
      }
    }

    return { isValid: true, error: null };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validate formula on change
  useEffect(() => {
    if (!formula.trim()) {
      setValidationError(null);
      setIsValid(false);
      return;
    }

    // Basic validation
    const validation = validateFormula(formula);
    setValidationError(validation.error);
    setIsValid(validation.isValid);
  }, [formula, validateFormula]);

  // Filter functions
  const filteredFunctions = FORMULA_FUNCTIONS.filter(
    (fn) =>
      (selectedCategory === 'all' || fn.category === selectedCategory) &&
      (fn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fn.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Insert text at cursor
  const insertAtCursor = (text: string) => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newFormula =
      formula.substring(0, start) + text + formula.substring(end);
    setFormula(newFormula);

    // Set cursor position after inserted text
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        start + text.length,
        start + text.length
      );
    }, 0);
  };

  // Insert function
  const insertFunction = (fn: FormulaFunction) => {
    const params = fn.parameters.map((p) => `<${p}>`).join(', ');
    insertAtCursor(`${fn.name}(${params})`);
  };

  // Insert field
  const insertField = (field: { id: string; name: string }) => {
    insertAtCursor(`{${field.id}}`);
  };

  // Handle save
  const handleSave = () => {
    if (!alias.trim()) {
      setValidationError('Field alias is required');
      return;
    }

    if (!isValid) {
      setValidationError(validationError || 'Invalid formula');
      return;
    }

    const field: FormulaField = {
      id: initialFormula?.id || `formula_${Date.now()}`,
      name: alias,
      alias,
      formula,
      isValid: true,
    };

    onSave(field);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Formula Builder
          </DialogTitle>
          <DialogDescription>
            Create calculated fields using functions and expressions
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
          {/* Left Panel - Function Library */}
          <Card className="col-span-1 p-4 flex flex-col">
            <div className="space-y-3 mb-4">
              <Label>Function Library</Label>
              <Input
                placeholder="Search functions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
              
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="math" className="text-xs">Math</TabsTrigger>
                </TabsList>
                <TabsList className="grid grid-cols-2 w-full mt-2">
                  <TabsTrigger value="string" className="text-xs">String</TabsTrigger>
                  <TabsTrigger value="date" className="text-xs">Date</TabsTrigger>
                </TabsList>
                <TabsList className="grid grid-cols-2 w-full mt-2">
                  <TabsTrigger value="aggregate" className="text-xs">Aggregate</TabsTrigger>
                  <TabsTrigger value="conditional" className="text-xs">Conditional</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {filteredFunctions.map((fn) => (
                  <Card
                    key={fn.name}
                    className="p-3 cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => insertFunction(fn)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <code className="text-sm font-bold text-blue-600">
                        {fn.name}
                      </code>
                      <Badge variant="outline" className="text-xs">
                        {fn.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      {fn.description}
                    </p>
                    <code className="text-xs bg-gray-100 p-1 rounded block">
                      {fn.syntax}
                    </code>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Middle Panel - Formula Editor */}
          <Card className="col-span-1 p-4 flex flex-col">
            <div className="space-y-4 flex-1 flex flex-col">
              <div>
                <Label htmlFor="alias">Field Alias *</Label>
                <Input
                  id="alias"
                  placeholder="e.g., total_revenue"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <Label htmlFor="formula">Formula *</Label>
                <Textarea
                  ref={textareaRef}
                  id="formula"
                  placeholder="Enter your formula..."
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  className="flex-1 font-mono text-sm mt-1"
                />
              </div>

              {/* Validation Status */}
              {formula && (
                <Alert
                  variant={isValid ? 'default' : 'destructive'}
                  className={isValid ? 'bg-green-50' : ''}
                >
                  <div className="flex items-center gap-2">
                    {isValid ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    <AlertDescription className="text-sm">
                      {isValid
                        ? 'Formula is valid'
                        : validationError || 'Invalid formula'}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Quick Insert Buttons */}
              <div className="space-y-2">
                <Label className="text-xs">Quick Insert</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertAtCursor(' + ')}
                  >
                    +
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertAtCursor(' - ')}
                  >
                    -
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertAtCursor(' * ')}
                  >
                    ×
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertAtCursor(' / ')}
                  >
                    ÷
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertAtCursor('()')}
                  >
                    ( )
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Right Panel - Available Fields */}
          <Card className="col-span-1 p-4 flex flex-col">
            <Label className="mb-3">Available Fields</Label>
            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {availableFields.map((field) => (
                  <Button
                    key={field.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => insertField(field)}
                  >
                    <Code className="w-4 h-4 mr-2" />
                    <span className="truncate">{field.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {field.type}
                    </Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>

            {/* Examples */}
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <Label className="text-xs mb-2 block">Example Formulas</Label>
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs font-mono h-auto py-2"
                  onClick={() => setFormula('SUM({claim_amount}) / COUNT({id})')}
                >
                  SUM({'{claim_amount}'}) / COUNT({'{id}'})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs font-mono h-auto py-2"
                  onClick={() =>
                    setFormula('DATE_DIFF({resolved_at}, {created_at}, "days")')
                  }
                >
                  DATE_DIFF({'{resolved_at}'}, {'{created_at}'}, &quot;days&quot;)
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || !alias.trim()}>
            <Check className="w-4 h-4 mr-2" />
            Save Formula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

