interface Props {
  label: string;
  value: string;
  trend: string | null;
}

export function MetricSnapshot({ label, value, trend }: Props) {
  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {trend && <p className="text-xs text-green-400 mt-1">{trend}</p>}
    </div>
  );
}
