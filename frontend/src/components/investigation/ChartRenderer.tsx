/**
 * Renders a chart from ChartConfig + data rows (≤50 row preview).
 * The LLM only emits ChartConfig — it never sees the raw data.
 */
import {
  LineChart, BarChart, AreaChart, ScatterChart, PieChart,
  Line, Bar, Area, Scatter, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { ChartConfig } from "@/types";

interface Props {
  config: ChartConfig;
  data: unknown[][];
}

const COLORS = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ef4444"];

export function ChartRenderer({ config, data }: Props) {
  // data is an array of rows; first row may be column names from the agent
  // The FE binds config.x_axis / config.y_axis as keys into row objects
  const rows = data.map((row) => ({
    [config.x_axis]: row[0],
    [config.y_axis]: row[1],
  }));

  const commonProps = {
    data: rows,
    margin: { top: 8, right: 16, left: 0, bottom: 8 },
  };

  const xAxis = <XAxis dataKey={config.x_axis} tick={{ fill: "#9ca3af", fontSize: 11 }} />;
  const yAxis = <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />;
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="#374151" />;
  const tooltip = <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", color: "#f9fafb" }} />;
  const legend = <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />;

  const renderChart = () => {
    switch (config.chart_type) {
      case "line":
        return <LineChart {...commonProps}>{grid}{xAxis}{yAxis}{tooltip}{legend}<Line type="monotone" dataKey={config.y_axis} stroke={COLORS[0]} name={config.series_label} dot={false} /></LineChart>;
      case "bar":
        return <BarChart {...commonProps}>{grid}{xAxis}{yAxis}{tooltip}{legend}<Bar dataKey={config.y_axis} fill={COLORS[0]} name={config.series_label} /></BarChart>;
      case "area":
        return <AreaChart {...commonProps}>{grid}{xAxis}{yAxis}{tooltip}{legend}<Area type="monotone" dataKey={config.y_axis} stroke={COLORS[0]} fill={COLORS[0] + "33"} name={config.series_label} /></AreaChart>;
      case "pie":
        return <PieChart><Pie data={rows} dataKey={config.y_axis} nameKey={config.x_axis} label>{rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>{tooltip}</PieChart>;
      default:
        return <BarChart {...commonProps}>{grid}{xAxis}{yAxis}{tooltip}<Bar dataKey={config.y_axis} fill={COLORS[0]} /></BarChart>;
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <ResponsiveContainer width="100%" height={240}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
