// src/pages/ReportsPage.jsx
import { useEffect, useMemo, useState } from "react";
import {
  apiGet, // import từ src/api.js (đã có sẵn)
} from "../api";

const today = new Date();
const oneMonthAgo = new Date(today);
oneMonthAgo.setDate(today.getDate() - 30);

function toInputDate(d) {
  return d.toISOString().slice(0, 10);
}

const TABS = [
  { id: "channel-summary", label: "Báo cáo theo kênh (tổng)" },
  { id: "channel-daily", label: "Báo cáo theo kênh (số liệu ngày)" },
  { id: "team", label: "Báo cáo theo team" },
  { id: "network", label: "Báo cáo theo network" },
  { id: "project", label: "Báo cáo theo dự án" },
  { id: "manager", label: "Báo cáo theo nhân sự" },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("channel-summary");

  const [from, setFrom] = useState(toInputDate(oneMonthAgo));
  const [to, setTo] = useState(toInputDate(today));

  const [teamId, setTeamId] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [managerId, setManagerId] = useState("");

  const [teams, setTeams] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [managers, setManagers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // data cho từng tab
  const [channelSummary, setChannelSummary] = useState([]);
  const [channelTimeseries, setChannelTimeseries] = useState([]);
  const [teamSummary, setTeamSummary] = useState([]);
  const [networkSummary, setNetworkSummary] = useState([]);
  const [projectSummary, setProjectSummary] = useState([]);

  // load dropdowns
  useEffect(() => {
    async function loadFilters() {
      try {
        const [t, n, s] = await Promise.all([
          apiGet("/teams"),
          apiGet("/networks"),
          apiGet("/staff"),
        ]);
        setTeams(t);
        setNetworks(n);
        // chỉ lấy nhân sự đang active, sort tên
        setManagers(
          (s || [])
            .filter((m) => m.role !== "deleted")
            .sort((a, b) =>
              a.full_name.localeCompare(b.full_name || "", "vi", {
                sensitivity: "base",
              })
            )
        );
      } catch (err) {
        console.error(err);
      }
    }
    loadFilters();
  }, []);

  const queryParams = useMemo(
    () => ({
      from,
      to,
      teamId: teamId || undefined,
      networkId: networkId || undefined,
      managerId: managerId || undefined,
    }),
    [from, to, teamId, networkId, managerId]
  );

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(queryParams).filter(([_, v]) => !!v)
        )
      ).toString();

      const [
        channels,
        timeseries,
        teamsData,
        networksData,
        projectsData,
      ] = await Promise.all([
        apiGet(`/dashboard/channels?${qs}`),
        apiGet(`/dashboard/channel-timeseries?${qs}`),
        apiGet(`/dashboard/team-summary?${qs}`),
        apiGet(`/dashboard/network-summary?${qs}`),
        apiGet(`/dashboard/project-summary?${qs}`),
      ]);

      setChannelSummary(channels || []);
      setChannelTimeseries(timeseries || []);
      setTeamSummary(teamsData || []);
      setNetworkSummary(networksData || []);
      setProjectSummary(projectsData || []);
    } catch (err) {
      console.error(err);
      setError("Không tải được dữ liệu báo cáo (DB error hoặc API lỗi).");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // load lần đầu

  // Pivot timeseries thành dạng bảng: mỗi kênh 4–5 dòng, mỗi cột là 1 ngày
  const { dates, pivotByChannel } = useMemo(() => {
    const datesSet = new Set();
    const byChannel = new Map();
    for (const row of channelTimeseries) {
      const d = row.date;
      datesSet.add(d);
      if (!byChannel.has(row.channel_id)) {
        byChannel.set(row.channel_id, {
          channelName: row.channel_name,
          dailyRevenue: {},
        });
      }
      const item = byChannel.get(row.channel_id);
      item.dailyRevenue[d] = Number(row.revenue || 0);
    }
    const datesSorted = Array.from(datesSet).sort();
    return {
      dates: datesSorted,
      pivotByChannel: byChannel,
    };
  }, [channelTimeseries]);

  // nhóm theo manager (nhân sự)
  const managerReport = useMemo(() => {
    const map = new Map();
    for (const ch of channelSummary) {
      const key = ch.manager_name || "Chưa gán";
      if (!map.has(key)) {
        map.set(key, {
          manager: key,
          views: 0,
          revenue: 0,
          usRevenue: 0,
        });
      }
      const item = map.get(key);
      item.views += Number(ch.views || 0);
      item.revenue += Number(ch.revenue || 0);
      item.usRevenue += Number(ch.us_revenue || 0);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.revenue - a.revenue
    );
  }, [channelSummary]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Báo cáo</h1>
      </div>

      {/* Bộ lọc giống hình demo */}
      <div className="bg-white shadow rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Khoảng thời gian</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-full"
              />
              <span className="text-xs text-gray-500">→</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-full"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Team</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">Tất cả team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Network</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={networkId}
              onChange={(e) => setNetworkId(e.target.value)}
            >
              <option value="">Tất cả network</option>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Nhân sự phụ trách</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">Tất cả</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.username}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="space-x-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`px-3 py-1 rounded-full text-xs md:text-sm ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Cập nhật
          </button>
        </div>

        {error && (
          <div className="mt-2 text-sm text-red-600 font-medium">{error}</div>
        )}
      </div>

      {/* Nội dung từng tab */}
      <div className="bg-white shadow rounded-xl p-4 overflow-auto">
        {loading && <div className="text-sm text-gray-500">Đang tải dữ liệu...</div>}

        {!loading && activeTab === "channel-summary" && (
          <ChannelSummaryTable data={channelSummary} />
        )}

        {!loading && activeTab === "channel-daily" && (
          <ChannelDailyMatrix
            dates={dates}
            pivotByChannel={pivotByChannel}
          />
        )}

        {!loading && activeTab === "team" && (
          <TeamReportTable data={teamSummary} />
        )}

        {!loading && activeTab === "network" && (
          <NetworkReportTable data={networkSummary} />
        )}

        {!loading && activeTab === "project" && (
          <ProjectReportTable data={projectSummary} />
        )}

        {!loading && activeTab === "manager" && (
          <ManagerReportTable data={managerReport} />
        )}
      </div>
    </div>
  );
}

/** BẢNG 1: Báo cáo tổng theo kênh */
function ChannelSummaryTable({ data }) {
  return (
    <div>
      <div className="mb-2 text-sm text-gray-500">
        Số lượng kênh: <b>{data.length}</b>
      </div>
      <table className="min-w-full text-sm border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 border">#</th>
            <th className="px-2 py-1 border">Kênh</th>
            <th className="px-2 py-1 border">YouTube ID</th>
            <th className="px-2 py-1 border">Team</th>
            <th className="px-2 py-1 border">Network</th>
            <th className="px-2 py-1 border">Manager</th>
            <th className="px-2 py-1 border text-right">Views</th>
            <th className="px-2 py-1 border text-right">Revenue</th>
            <th className="px-2 py-1 border text-right">US Rev</th>
            <th className="px-2 py-1 border text-right">RPM</th>
          </tr>
        </thead>
        <tbody>
          {data.map((ch, idx) => (
            <tr key={ch.id || idx} className="hover:bg-gray-50">
              <td className="px-2 py-1 border text-center">{idx + 1}</td>
              <td className="px-2 py-1 border">
                <a
                  href={`https://www.youtube.com/channel/${ch.youtube_channel_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {ch.name}
                </a>
              </td>
              <td className="px-2 py-1 border font-mono text-xs">
                {ch.youtube_channel_id}
              </td>
              <td className="px-2 py-1 border">{ch.team_name || "—"}</td>
              <td className="px-2 py-1 border">{ch.network_name || "—"}</td>
              <td className="px-2 py-1 border">{ch.manager_name || "—"}</td>
              <td className="px-2 py-1 border text-right">
                {Number(ch.views || 0).toLocaleString("en-US")}
              </td>
              <td className="px-2 py-1 border text-right">
                {Number(ch.revenue || 0).toFixed(3)}
              </td>
              <td className="px-2 py-1 border text-right">
                {Number(ch.us_revenue || 0).toFixed(3)}
              </td>
              <td className="px-2 py-1 border text-right">
                {Number(ch.rpm || 0).toFixed(2)}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={10}
                className="text-center text-sm text-gray-500 py-4"
              >
                Chưa có dữ liệu cho bộ lọc hiện tại.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** BẢNG 2: Ma trận doanh thu theo ngày – giống hình “Báo cáo theo kênh (số liệu)” */
function ChannelDailyMatrix({ dates, pivotByChannel }) {
  const channels = Array.from(pivotByChannel.values());

  return (
    <div className="overflow-auto">
      <div className="mb-2 text-sm text-gray-500">
        Số kênh: <b>{channels.length}</b> – Số ngày: <b>{dates.length}</b>
      </div>
      <table className="min-w-full text-xs border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th rowSpan={2} className="px-2 py-1 border">
              #
            </th>
            <th rowSpan={2} className="px-2 py-1 border">
              Kênh
            </th>
            <th colSpan={dates.length} className="px-2 py-1 border">
              Doanh thu theo ngày
            </th>
          </tr>
          <tr>
            {dates.map((d) => (
              <th key={d} className="px-2 py-1 border min-w-[70px]">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {channels.map((ch, idx) => (
            <tr key={ch.channelName + idx}>
              <td className="px-2 py-1 border text-center">{idx + 1}</td>
              <td className="px-2 py-1 border whitespace-nowrap">
                {ch.channelName}
              </td>
              {dates.map((d) => (
                <td
                  key={d}
                  className="px-1 py-1 border text-right"
                >
                  {Number(ch.dailyRevenue[d] || 0).toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
          {channels.length === 0 && (
            <tr>
              <td
                colSpan={2 + dates.length}
                className="text-center text-gray-500 py-4"
              >
                Chưa có dữ liệu cho bộ lọc hiện tại.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** BẢNG 3: Báo cáo theo team */
function TeamReportTable({ data }) {
  return (
    <SimpleAggTable
      title="Team"
      rows={data.map((t) => ({
        key: t.id,
        name: t.team_name,
        views: t.views,
        revenue: t.revenue,
      }))}
    />
  );
}

/** BẢNG 4: Báo cáo theo network */
function NetworkReportTable({ data }) {
  return (
    <SimpleAggTable
      title="Network"
      rows={data.map((n) => ({
        key: n.id,
        name: n.network_name,
        views: n.views,
        revenue: n.revenue,
      }))}
    />
  );
}

/** BẢNG 5: Báo cáo theo dự án */
function ProjectReportTable({ data }) {
  return (
    <SimpleAggTable
      title="Dự án"
      rows={data.map((p) => ({
        key: p.id,
        name: p.project_name,
        views: p.views,
        revenue: p.revenue,
      }))}
    />
  );
}

/** BẢNG 6: Báo cáo theo nhân sự (gộp từ dữ liệu kênh) */
function ManagerReportTable({ data }) {
  return (
    <SimpleAggTable
      title="Nhân sự"
      rows={data.map((m, idx) => ({
        key: idx,
        name: m.manager,
        views: m.views,
        revenue: m.revenue,
        usRevenue: m.usRevenue,
      }))}
      showUsRevenue
    />
  );
}

function SimpleAggTable({ title, rows, showUsRevenue = false }) {
  return (
    <div>
      <div className="mb-2 text-sm text-gray-500">
        Số {title.toLowerCase()}: <b>{rows.length}</b>
      </div>
      <table className="min-w-full text-sm border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 border">#</th>
            <th className="px-2 py-1 border text-left">{title}</th>
            <th className="px-2 py-1 border text-right">Views</th>
            <th className="px-2 py-1 border text-right">Revenue</th>
            {showUsRevenue && (
              <th className="px-2 py-1 border text-right">US Rev</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.key || idx} className="hover:bg-gray-50">
              <td className="px-2 py-1 border text-center">{idx + 1}</td>
              <td className="px-2 py-1 border">{r.name || "—"}</td>
              <td className="px-2 py-1 border text-right">
                {Number(r.views || 0).toLocaleString("en-US")}
              </td>
              <td className="px-2 py-1 border text-right">
                {Number(r.revenue || 0).toFixed(3)}
              </td>
              {showUsRevenue && (
                <td className="px-2 py-1 border text-right">
                  {Number(r.usRevenue || 0).toFixed(3)}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={showUsRevenue ? 5 : 4}
                className="text-center text-gray-500 py-4"
              >
                Chưa có dữ liệu cho bộ lọc hiện tại.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
