import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import api from "../api/axios";

const PIE_COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];

function StatCard({ title, value, subtitle }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

function Statistics() {
  const [stats, setStats] = useState(null);
  const [interval, setInterval] = useState("day");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/analytics/statistics/", {
          params: { interval, top_tags: 8 },
        });

        setStats(res.data);
      } catch {
        setError("Failed to load statistics.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [interval]);

  const ocrCoverageChartData = useMemo(() => {
    if (!stats?.ocr_coverage) return [];
    return [
      { name: "Searchable", value: stats.ocr_coverage.with_extracted_text },
      { name: "Not searchable", value: stats.ocr_coverage.without_extracted_text },
    ];
  }, [stats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4">
          <div className="h-10 w-64 rounded bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-4">
            <div className="h-24 rounded bg-slate-200" />
            <div className="h-24 rounded bg-slate-200" />
            <div className="h-24 rounded bg-slate-200" />
            <div className="h-24 rounded bg-slate-200" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-80 rounded bg-slate-200" />
            <div className="h-80 rounded bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Analytics</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Statistics Dashboard</h1>
          </div>

          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="day">Daily activity</option>
            <option value="week">Weekly activity</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Documents" value={stats.kpis.total_documents} />
          <StatCard title="Organized Documents" value={stats.kpis.organized_documents} />
          <StatCard title="Unorganized Documents" value={stats.kpis.unorganized_documents} />
          <StatCard
            title="OCR Coverage"
            value={`${stats.ocr_coverage.percentage_with_extracted_text}%`}
            subtitle={`${stats.kpis.search_ready_documents} searchable`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Upload Activity Over Time
            </h2>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.upload_activity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#0f172a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Tag Distribution
            </h2>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.tag_distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#334155" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              File Type Breakdown
            </h2>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.file_type_breakdown}
                    dataKey="count"
                    nameKey="name"
                    outerRadius={100}
                    label
                  >
                    {stats.file_type_breakdown.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              OCR Coverage
            </h2>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ocrCoverageChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={100}
                    label
                  >
                    {ocrCoverageChartData.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Statistics;