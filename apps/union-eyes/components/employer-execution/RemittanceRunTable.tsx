type RemittanceRunRow = {
  id: string;
  runCode: string;
  status: string;
  dueDate: string;
  totalDue: string;
};

export function RemittanceRunTable({ rows }: { rows: RemittanceRunRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Run</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Due Date</th>
            <th className="px-3 py-2">Total Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="px-3 py-2">{row.runCode}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2">{row.dueDate}</td>
              <td className="px-3 py-2">{row.totalDue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
