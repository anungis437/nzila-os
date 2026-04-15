type ValidationRow = {
  rowNumber: number;
  employeeExternalId: string;
  shiftDate: string;
  regularHours: string;
  overtimeHours: string;
  status: string;
  validationErrors: string[];
};

export function TimesheetValidationTable({ rows }: { rows: ValidationRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Row</th>
            <th className="px-3 py-2">Employee</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Regular</th>
            <th className="px-3 py-2">Overtime</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Validation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.rowNumber}-${row.employeeExternalId}`} className="border-t">
              <td className="px-3 py-2">{row.rowNumber}</td>
              <td className="px-3 py-2">{row.employeeExternalId}</td>
              <td className="px-3 py-2">{row.shiftDate}</td>
              <td className="px-3 py-2">{row.regularHours}</td>
              <td className="px-3 py-2">{row.overtimeHours}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2">{row.validationErrors?.join(", ") || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
