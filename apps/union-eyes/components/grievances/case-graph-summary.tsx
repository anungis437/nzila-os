"use client";

export function CaseGraphSummary(props: {
  graph: {
    nodes: Array<{ id: string; type: string }>;
    edges: Array<{ id: string; type: string }>;
  };
  loading?: boolean;
}) {
  if (props.loading) {
    return <div className="rounded-lg border bg-white p-4 text-xs text-gray-500">Loading knowledge graph…</div>;
  }

  const counts = props.graph.nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Case Graph Summary</h3>
        <p className="text-xs text-gray-500">Derived only from authorized case relationships</p>
      </div>
      <p className="text-xs text-gray-600">{props.graph.nodes.length} nodes and {props.graph.edges.length} edges</p>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {Object.entries(counts).map(([type, count]) => (
          <div key={type} className="rounded bg-slate-50 px-2 py-1 text-[11px]">
            <span className="font-medium">{type}</span>: {count}
          </div>
        ))}
      </div>
    </div>
  );
}
