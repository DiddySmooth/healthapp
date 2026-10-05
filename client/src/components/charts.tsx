import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./ui";

// Shared theme bits: recessive grid/axes, text in ink colors (never series color).
export const chartTheme = {
  grid: { stroke: "#26282E", strokeDasharray: "3 3", vertical: false as const },
  axisTick: {
    fill: "#5C6069",
    fontSize: 11,
    fontFamily: "'JetBrains Mono Variable', monospace",
  },
  axisLine: { stroke: "#26282E" },
  tooltip: {
    contentStyle: {
      backgroundColor: "#141518",
      border: "1px solid #26282E",
      borderRadius: 10,
      fontSize: 12,
      color: "#F4F4F2",
      fontFamily: "'JetBrains Mono Variable', monospace",
    },
    labelStyle: { color: "#9BA0AA" },
    cursor: { fill: "#1C1E2255" },
  },
};

// Domain palette (see docs/redesign/PLAN.md): workout=volt, food=amber,
// water=sky, body=violet.
export const chartColors = {
  volt: "#C8F04B",
  food: "#F5A623",
  water: "#4CC3F7",
  body: "#C792EA",
};

export function ChartCard({
  title,
  subtitle,
  children,
  empty,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="mb-2 text-xs text-muted">{subtitle}</p>}
      {empty ? (
        <p className="py-10 text-center text-sm text-faint">No data yet.</p>
      ) : (
        <div className="mt-2 h-56">{children}</div>
      )}
    </Card>
  );
}

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Single-series bar chart: thin marks, rounded data-ends, optional target line.
export function DailyBars({
  data,
  dataKey,
  color,
  target,
  unit,
}: {
  data: { date: string }[];
  dataKey: string;
  color: string;
  target?: number | null;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid {...chartTheme.grid} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={chartTheme.axisTick}
          axisLine={chartTheme.axisLine}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis tick={chartTheme.axisTick} axisLine={false} tickLine={false} />
        <Tooltip
          {...chartTheme.tooltip}
          labelFormatter={(v) => shortDate(String(v))}
          formatter={(value) => [
            `${Math.round(Number(value)).toLocaleString()}${unit ? ` ${unit}` : ""}`,
            "",
          ]}
          separator=""
        />
        {target != null && target > 0 && (
          <ReferenceLine
            y={target}
            stroke="#9BA0AA"
            strokeDasharray="4 4"
            label={{
              value: `target ${target.toLocaleString()}`,
              fill: "#9BA0AA",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
        )}
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export type LineSeries = {
  dataKey: string;
  color: string;
  name: string;
};

// One-or-two series line chart on a single axis, 2px strokes, ≥8px markers.
export function TrendLines({
  data,
  series,
  xKey = "date",
  unit,
}: {
  data: Record<string, unknown>[];
  series: LineSeries[];
  xKey?: string;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid {...chartTheme.grid} />
        <XAxis
          dataKey={xKey}
          tickFormatter={(v) => shortDate(String(v))}
          tick={chartTheme.axisTick}
          axisLine={chartTheme.axisLine}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={chartTheme.axisTick}
          axisLine={false}
          tickLine={false}
          domain={["auto", "auto"]}
        />
        <Tooltip
          {...chartTheme.tooltip}
          labelFormatter={(v) => shortDate(String(v))}
          formatter={(value, name) => [
            `${Number(value).toLocaleString()}${unit ? ` ${unit}` : ""}`,
            String(name),
          ]}
        />
        {series.map((s) => (
          <Line
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Tiny axis-less sparkline for stat tiles.
export function Sparkline({
  data,
  dataKey,
  color,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
