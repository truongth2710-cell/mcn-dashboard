import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { api } from "./api";

/* ---------- helpers ---------- */

function formatNumber(n) {
  return (n || 0).toLocaleString("en-US");
}

function formatCurrency(n) {
  return (n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Hook load dữ liệu dashboard theo khoảng ngày + filter nâng cao.
 */
function useDashboardData(from, to, filters) {
  const [summary, setSummary] = useState(null);
  const [channels, setChannels] = useState([]);
  const [teamSummary, setTeamSummary] = useState([]);
  const [networkSummary, setNetworkSummary] = useState([]);
  const [projectSummary, setProjectSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buildQueryString = () => {
    const parts = [];
    if (from) parts.push(`from=${from}`);
    if (to) parts.push(`to=${to}`);
    if (filters?.teamId) parts.push(`teamId=${filters.teamId}`);
    if (filters?.networkId) parts.push(`networkId=${filters.networkId}`);
    if (filters?.managerId) parts.push(`managerId=${filters.managerId}`);
    return parts.length ? "?" + parts.join("&") : "";
  };

  const reload = async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = buildQueryString();
      const [s, c, ts, ns, ps] = await Promise.all([
        api("/dashboard/summary" + qs),
        api("/dashboard/channels" + qs),
        api("/dashboard/team-summary" + qs),
        api("/dashboard/network-summary" + qs),
        api("/dashboard/project-summary" + qs)
      ]);
      setSummary(s);
      setChannels(c);
      setTeamSummary(ts);
      setNetworkSummary(ns);
      setProjectSummary(ps);
    } catch (e) {
      setError(e.message || "Dashboard load error");
    } finally {
      setLoading(false);
    }
  };

  return {
    summary,
    channels,
    teamSummary,
    networkSummary,
    projectSummary,
    loading,
    error,
    reload
  };
}

/**
 * Hook load timeseries doanh thu kênh để vẽ biểu đồ.
 */
function useChannelTimeseries(from, to, filters) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buildQueryString = () => {
    const parts = [];
    if (from) parts.push(`from=${from}`);
    if (to) parts.push(`to=${to}`);
    if (filters?.teamId) parts.push(`teamId=${filters.teamId}`);
    if (filters?.networkId) parts.push(`networkId=${filters.networkId}`);
    if (filters?.managerId) parts.push(`managerId=${filters.managerId}`);
    return parts.length ? "?" + parts.join("&") : "";
  };

  const reload = async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = buildQueryString();
      const data = await api("/dashboard/channel-timeseries" + qs);
      setSeries(data || []);
    } catch (e) {
      setError(e.message || "Timeseries load error");
    } finally {
      setLoading(false);
    }
  };

  return { series, loading, error, reload };
}

/* ---------- auth / layout ---------- */

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setError(null);
    try {
      const res = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem("yt_token", res.token);
      localStorage.setItem("yt_user", JSON.stringify(res.user));
      onLoggedIn(res.user);
    } catch (e) {
      setError(e.message || "Login error");
    }
  };

  const handleRegister = async () => {
    setError(null);
    try {
      const res = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, name: name || email, password })
      });
      localStorage.setItem("yt_token", res.token);
      localStorage.setItem("yt_user", JSON.stringify(res.user));
      onLoggedIn(res.user);
    } catch (e) {
      setError(e.message || "Register error");
    }
  };

  return (
    <div className="full-center">
      <div className="card login-card">
        <h2 style={{ marginBottom: 16 }}>Đăng nhập / Đăng ký</h2>
        <div className="form-grid">
          <input
            type="email"
            placeholder="Email công ty / Gmail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="text"
            placeholder="Tên hiển thị (khi đăng ký)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="btn-row">
            <button onClick={handleLogin}>Đăng nhập</button>
            <button className="secondary" onClick={handleRegister}>
              Đăng ký
            </button>
          </div>
          {error && <div className="error">Lỗi: {error}</div>}
        </div>
      </div>
    </div>
  );
}

function TopBar({ user, onLogout, currentTab, setTab }) {
  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "channels", label: "Kênh" },
    { key: "staff", label: "Nhân sự" },
    { key: "teams", label: "Team" },
    { key: "networks", label: "Network" },
    { key: "projects", label: "Dự án" }
  ];
  return (
    <div className="card flex-between topbar">
      <div className="flex gap-16 align-center">
        <h2 className="app-title">Sun Media YouTube Dashboard</h2>
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={currentTab === t.key ? "tab active" : "tab"}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-8 align-center">
        <div className="user-pill">
          <span className="user-name">{user?.name}</span>
          <span className="user-role">{user?.role}</span>
        </div>
        <button className="secondary" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

/* ---------- generic components ---------- */

function SimpleListCard({ title, items, columns, emptyLabel = "Chưa có dữ liệu" }) {
  return (
    <div className="card">
      <div className="flex-between card-header">
        <div className="card-title">{title}</div>
        <span className="badge">{items.length}</span>
      </div>
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id || row[columns[0].key]}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={c.align === "right" ? "ta-right" : undefined}
                >
                  {c.render
                    ? c.render(row[c.key], row)
                    : c.format
                    ? c.format(row[c.key], row)
                    : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center", padding: 12 }}>
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- dashboard ---------- */

function SummaryCards({ summary }) {
  return (
    <div className="card">
      <div className="card-title">Tổng quan</div>
      <div className="grid grid-4 kpi-grid">
        <div className="kpi">
          <div className="label">Tổng views</div>
          <div className="value-lg">{formatNumber(summary?.totalViews)}</div>
        </div>
        <div className="kpi">
          <div className="label">Tổng doanh thu</div>
          <div className="value-lg">{formatCurrency(summary?.totalRevenue)}</div>
        </div>
        <div className="kpi">
          <div className="label">Doanh thu Hoa Kỳ</div>
          <div className="value-lg">
            {formatCurrency(summary?.totalUsRevenue)}
          </div>
        </div>
        <div className="kpi">
          <div className="label">RPM trung bình</div>
          <div className="value-lg">
            {summary ? summary.avgRPM.toFixed(2) : "0.00"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelChart({ from, to, filters }) {
  const { series, loading, error, reload } = useChannelTimeseries(from, to, filters);

  // build recharts data: mỗi ngày 1 object, mỗi channel 1 field `ch_${id}`
  const { data, lines } = useMemo(() => {
    const byDate = new Map();
    const channelNames = new Map();

    for (const row of series) {
      const date = row.date;
      const id = row.channel_id;
      const key = `ch_${id}`;
      channelNames.set(key, row.channel_name);
      if (!byDate.has(date)) {
        byDate.set(date, { date });
      }
      byDate.get(date)[key] = Number(row.revenue || 0);
    }

    const dataArr = Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const keys = Array.from(channelNames.keys());
    const linesArr = keys.map((key, idx) => ({
      dataKey: key,
      name: channelNames.get(key),
      strokeIndex: idx
    }));

    return { data: dataArr, lines: linesArr };
  }, [series]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, filters.teamId, filters.networkId, filters.managerId]);

  return (
    <div className="card">
      <div className="flex-between card-header">
        <div className="card-title">Doanh thu kênh (biểu đồ)</div>
        <div>
          {loading && <span className="muted">Đang tải...</span>}
          {error && <span className="error-inline">Lỗi: {error}</span>}
        </div>
      </div>
      {data.length === 0 ? (
        <div style={{ padding: 16, textAlign: "center" }}>Chưa có dữ liệu.</div>
      ) : (
        <div style={{ width: "100%", height: 400 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {lines.map((l) => (
                <Line
                  key={l.dataKey}
                  type="monotone"
                  dataKey={l.dataKey}
                  name={l.name}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function DashboardTab({
  summary,
  channels,
  teamSummary,
  networkSummary,
  projectSummary,
  from,
  to,
  setFrom,
  setTo,
  filterTeamId,
  setFilterTeamId,
  filterNetworkId,
  setFilterNetworkId,
  filterManagerId,
  setFilterManagerId,
  staff,
  teams,
  networks,
  loading,
  error,
  reload
}) {
  const filters = { teamId: filterTeamId, networkId: filterNetworkId, managerId: filterManagerId };

  return (
    <>
      <div className="card filter-bar">
        <div className="filter-group">
          <span className="filter-label">Khoảng thời gian:</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        <div className="filter-group">
          <select
            value={filterTeamId}
            onChange={(e) => setFilterTeamId(e.target.value)}
          >
            <option value="">Tất cả team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={filterNetworkId}
            onChange={(e) => setFilterNetworkId(e.target.value)}
          >
            <option value="">Tất cả network</option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          <select
            value={filterManagerId}
            onChange={(e) => setFilterManagerId(e.target.value)}
          >
            <option value="">Tất cả manager</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button onClick={reload}>Cập nhật</button>
        </div>

        <div>
          {loading && <span className="muted">Đang tải dữ liệu...</span>}
          {error && <span className="error-inline">Lỗi: {error}</span>}
        </div>
      </div>

      <SummaryCards summary={summary} />

      <ChannelsTable
        title="Kênh (trong dashboard)"
        channels={channels}
        showConnectButton={false}
        isAdmin={false}
      />

      <ChannelChart from={from} to={to} filters={filters} />

      <div className="grid grid-3">
        <SimpleListCard
          title="Theo Team"
          items={teamSummary}
          columns={[
            { key: "team_name", label: "Team" },
            { key: "views", label: "Views", align: "right", format: formatNumber },
            {
              key: "revenue",
              label: "Revenue",
              align: "right",
              format: formatCurrency
            }
          ]}
        />
        <SimpleListCard
          title="Theo Network"
          items={networkSummary}
          columns={[
            { key: "network_name", label: "Network" },
            { key: "views", label: "Views", align: "right", format: formatNumber },
            {
              key: "revenue",
              label: "Revenue",
              align: "right",
              format: formatCurrency
            }
          ]}
        />
        <SimpleListCard
          title="Theo Dự án"
          items={projectSummary}
          columns={[
            { key: "project_name", label: "Dự án" },
            { key: "views", label: "Views", align: "right", format: formatNumber },
            {
              key: "revenue",
              label: "Revenue",
              align: "right",
              format: formatCurrency
            }
          ]}
        />
      </div>
    </>
  );
}

/* ---------- channels tab ---------- */

function ChannelAvatar({ name, avatar_url }) {
  const initial = (name || "?")[0].toUpperCase();
  if (avatar_url) {
    return (
      <img
        src={avatar_url}
        alt={name}
        className="channel-avatar"
      />
    );
  }
  return <div className="channel-avatar placeholder">{initial}</div>;
}

function ChannelsTable({
  title = "Kênh",
  channels,
  showConnectButton,
  isAdmin,
  staffOptions = [],
  teamOptions = [],
  networkOptions = [],
  onUpdateChannelMeta,
  onDelete
}) {
  const [search, setSearch] = useState("");
  const [filterTeamId, setFilterTeamId] = useState("");
  const [filterNetworkId, setFilterNetworkId] = useState("");
  const [filterManagerId, setFilterManagerId] = useState("");

  const filtered = useMemo(() => {
    let list = channels || [];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (ch) =>
          ch.name?.toLowerCase().includes(s) ||
          ch.youtube_channel_id?.toLowerCase().includes(s)
      );
    }
    if (filterTeamId) {
      list = list.filter((ch) => String(ch.team_id || "") === String(filterTeamId));
    }
    if (filterNetworkId) {
      list = list.filter(
        (ch) => String(ch.network_id || "") === String(filterNetworkId)
      );
    }
    if (filterManagerId) {
      list = list.filter(
        (ch) => String(ch.manager_id || "") === String(filterManagerId)
      );
    }
    return list;
  }, [channels, search, filterTeamId, filterNetworkId, filterManagerId]);

  const handleConnect = async () => {
    try {
      const res = await api("/youtube/connect-url");
      window.location.href = res.url;
    } catch (e) {
      alert("Không lấy được link kết nối: " + e.message);
    }
  };

  const handleMetaChange = (ch, field, value) => {
    if (!onUpdateChannelMeta) return;
    const parsedValue = value ? Number(value) : null;
    onUpdateChannelMeta({
      ...ch,
      [field]: parsedValue
    });
  };

  const openChannel = (youtubeId) => {
    if (!youtubeId) return;
    const url = `https://www.youtube.com/channel/${youtubeId}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="card">
      <div className="flex-between card-header">
        <div className="card-title">{title}</div>
        <div className="flex gap-8 align-center">
          <input
            className="search-input"
            placeholder="Tìm theo tên kênh / ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={filterTeamId}
            onChange={(e) => setFilterTeamId(e.target.value)}
          >
            <option value="">All team</option>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={filterNetworkId}
            onChange={(e) => setFilterNetworkId(e.target.value)}
          >
            <option value="">All network</option>
            {networkOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          <select
            value={filterManagerId}
            onChange={(e) => setFilterManagerId(e.target.value)}
          >
            <option value="">All manager</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {showConnectButton && (
            <button onClick={handleConnect}>Kết nối kênh YouTube</button>
          )}
          <span className="badge">{channels?.length || 0} kênh</span>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: "26%" }}>Kênh</th>
            <th>YouTube ID</th>
            <th>Network</th>
            <th>Team</th>
            <th>Manager</th>
            <th className="ta-right">Subs</th>
            <th className="ta-right">Views</th>
            <th className="ta-right">Revenue</th>
            <th className="ta-right">US Rev</th>
            <th className="ta-right">RPM</th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((ch) => {
            const rowId = ch.channel_id || ch.id;
            const rpmVal = Number(ch.rpm ?? 0);
            const subs = ch.subscribers || 0;
            return (
              <tr key={rowId}>
                <td>
                  <div
                    className="channel-cell"
                    onClick={() => openChannel(ch.youtube_channel_id)}
                    style={{ cursor: ch.youtube_channel_id ? "pointer" : "default" }}
                  >
                    <ChannelAvatar name={ch.name} avatar_url={ch.avatar_url} />
                    <div className="channel-meta">
                      <div className="channel-name">{ch.name}</div>
                      <div className="channel-subs">
                        {subs ? `${formatNumber(subs)} subs` : "—"}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{ch.youtube_channel_id}</td>
                <td>
                  {isAdmin && networkOptions.length ? (
                    <select
                      value={ch.network_id || ""}
                      onChange={(e) =>
                        handleMetaChange(ch, "network_id", e.target.value)
                      }
                    >
                      <option value="">(none)</option>
                      {networkOptions.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ch.network_name || "-"
                  )}
                </td>
                <td>
                  {isAdmin && teamOptions.length ? (
                    <select
                      value={ch.team_id || ""}
                      onChange={(e) =>
                        handleMetaChange(ch, "team_id", e.target.value)
                      }
                    >
                      <option value="">(none)</option>
                      {teamOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ch.team_name || "-"
                  )}
                </td>
                <td>
                  {isAdmin && staffOptions.length ? (
                    <select
                      value={ch.manager_id || ""}
                      onChange={(e) =>
                        handleMetaChange(ch, "manager_id", e.target.value)
                      }
                    >
                      <option value="">(none)</option>
                      {staffOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ch.manager_name || "-"
                  )}
                </td>
                <td className="ta-right">
                  {subs ? formatNumber(subs) : "—"}
                </td>
                <td className="ta-right">{formatNumber(ch.views)}</td>
                <td className="ta-right">{formatCurrency(ch.revenue)}</td>
                <td className="ta-right">
                  {formatCurrency(ch.us_revenue ?? ch.revenue)}
                </td>
                <td className="ta-right">{rpmVal.toFixed(2)}</td>
                {isAdmin && (
                  <td className="ta-right">
                    <button
                      className="danger small"
                      onClick={() => onDelete && onDelete(ch)}
                    >
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
          {!filtered.length && (
            <tr>
              <td colSpan={isAdmin ? 11 : 10} style={{ textAlign: "center", padding: 16 }}>
                Chưa có kênh nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- staff / teams / networks / projects tabs ---------- */

function StaffTab({ staff, isAdmin, reloadMaster, channels }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignChannelId, setAssignChannelId] = useState("");
  const [assignRole, setAssignRole] = useState("manager");
  const [assignLoading, setAssignLoading] = useState(false);

  const createStaff = async () => {
    if (!email || !password) return;
    setLoading(true);
    setErr(null);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, name: name || email, password, role })
      });
      setEmail("");
      setName("");
      setPassword("");
      setRole("viewer");
      await reloadMaster();
    } catch (e) {
      setErr(e.message || "Create staff error");
    } finally {
      setLoading(false);
    }
  };

  const deleteStaff = async (s) => {
    if (!window.confirm(`Xóa nhân sự "${s.name}"?`)) return;
    try {
      await api(`/staff/${s.id}`, { method: "DELETE" });
      await reloadMaster();
    } catch (e) {
      alert("Lỗi xóa nhân sự: " + e.message);
    }
  };

  const assignChannel = async () => {
    if (!assignStaffId || !assignChannelId) return;
    setAssignLoading(true);
    try {
      await api("/channels/assign", {
        method: "POST",
        body: JSON.stringify({
          staff_id: Number(assignStaffId),
          channel_id: Number(assignChannelId),
          role: assignRole
        })
      });
      alert("Gán kênh cho nhân sự thành công!");
    } catch (e) {
      alert("Lỗi gán kênh: " + e.message);
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <>
      {isAdmin && (
        <div className="card">
          <div className="card-title">Thêm nhân sự</div>
          <div className="form-grid mg-top-8">
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              placeholder="Tên"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="viewer">viewer</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
            <div className="btn-row">
              <button disabled={loading} onClick={createStaff}>
                Tạo nhân sự
              </button>
              {err && <span className="error-inline">{err}</span>}
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <div className="card-title">Gán kênh cho nhân sự</div>
          <div className="form-grid mg-top-8">
            <select
              value={assignStaffId}
              onChange={(e) => setAssignStaffId(e.target.value)}
            >
              <option value="">Chọn nhân sự...</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
            <select
              value={assignChannelId}
              onChange={(e) => setAssignChannelId(e.target.value)}
            >
              <option value="">Chọn kênh...</option>
              {channels.map((c) => (
                <option key={c.channel_id || c.id} value={c.channel_id || c.id}>
                  {c.name} ({c.youtube_channel_id})
                </option>
              ))}
            </select>
            <select
              value={assignRole}
              onChange={(e) => setAssignRole(e.target.value)}
            >
              <option value="manager">manager</option>
              <option value="editor">editor</option>
            </select>
            <div className="btn-row">
              <button disabled={assignLoading} onClick={assignChannel}>
                Gán kênh
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex-between card-header">
          <div className="card-title">Danh sách nhân sự</div>
          <span className="badge">{staff.length}</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Email</th>
              <th>Role</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.email}</td>
                <td>{s.role}</td>
                {isAdmin && (
                  <td className="ta-right">
                    <button
                      className="danger small"
                      onClick={() => deleteStaff(s)}
                    >
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!staff.length && (
              <tr>
                <td
                  colSpan={isAdmin ? 4 : 3}
                  style={{ textAlign: "center", padding: 12 }}
                >
                  Chưa có nhân sự nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TeamsTab({ teams, reloadMaster, isAdmin }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name) return;
    setLoading(true);
    try {
      if (editing) {
        await api(`/teams/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name, description: desc })
        });
      } else {
        await api("/teams", {
          method: "POST",
          body: JSON.stringify({ name, description: desc })
        });
      }
      setName("");
      setDesc("");
      setEditing(null);
      await reloadMaster();
    } catch (e) {
      alert("Lỗi lưu team: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (t) => {
    setEditing(t);
    setName(t.name);
    setDesc(t.description || "");
  };

  const cancelEdit = () => {
    setEditing(null);
    setName("");
    setDesc("");
  };

  const del = async (t) => {
    if (!window.confirm(`Xóa team "${t.name}"?`)) return;
    try {
      await api(`/teams/${t.id}`, { method: "DELETE" });
      await reloadMaster();
    } catch (e) {
      alert("Lỗi xóa team: " + e.message);
    }
  };

  return (
    <>
      {isAdmin && (
        <div className="card">
          <div className="card-title">
            {editing ? `Sửa Team: ${editing.name}` : "Thêm Team"}
          </div>
          <div className="form-grid mg-top-8">
            <input
              placeholder="Tên team"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Mô tả"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <div className="btn-row">
              <button disabled={loading} onClick={save}>
                {editing ? "Lưu" : "Thêm team"}
              </button>
              {editing && (
                <button className="secondary" onClick={cancelEdit}>
                  Hủy
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex-between card-header">
          <div className="card-title">Danh sách Team</div>
          <span className="badge">{teams.length}</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Tên team</th>
              <th>Mô tả</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.description}</td>
                {isAdmin && (
                  <td className="ta-right">
                    <button className="small" onClick={() => startEdit(t)}>
                      Sửa
                    </button>
                    <button className="danger small" onClick={() => del(t)}>
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!teams.length && (
              <tr>
                <td colSpan={isAdmin ? 3 : 2} style={{ textAlign: "center", padding: 12 }}>
                  Chưa có team nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function NetworksTab({ networks, reloadMaster, isAdmin }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name) return;
    setLoading(true);
    try {
      if (editing) {
        await api(`/networks/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name, description: desc })
        });
      } else {
        await api("/networks", {
          method: "POST",
          body: JSON.stringify({ name, description: desc })
        });
      }
      setName("");
      setDesc("");
      setEditing(null);
      await reloadMaster();
    } catch (e) {
      alert("Lỗi lưu network: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (n) => {
    setEditing(n);
    setName(n.name);
    setDesc(n.description || "");
  };

  const cancelEdit = () => {
    setEditing(null);
    setName("");
    setDesc("");
  };

  const del = async (n) => {
    if (!window.confirm(`Xóa network "${n.name}"?`)) return;
    try {
      await api(`/networks/${n.id}`, { method: "DELETE" });
      await reloadMaster();
    } catch (e) {
      alert("Lỗi xóa network: " + e.message);
    }
  };

  return (
    <>
      {isAdmin && (
        <div className="card">
          <div className="card-title">
            {editing ? `Sửa Network: ${editing.name}` : "Thêm Network"}
          </div>
          <div className="form-grid mg-top-8">
            <input
              placeholder="Tên network"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Mô tả"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <div className="btn-row">
              <button disabled={loading} onClick={save}>
                {editing ? "Lưu" : "Thêm network"}
              </button>
              {editing && (
                <button className="secondary" onClick={cancelEdit}>
                  Hủy
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex-between card-header">
          <div className="card-title">Danh sách Network</div>
          <span className="badge">{networks.length}</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Mô tả</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {networks.map((n) => (
              <tr key={n.id}>
                <td>{n.name}</td>
                <td>{n.description}</td>
                {isAdmin && (
                  <td className="ta-right">
                    <button className="small" onClick={() => startEdit(n)}>
                      Sửa
                    </button>
                    <button className="danger small" onClick={() => del(n)}>
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!networks.length && (
              <tr>
                <td colSpan={isAdmin ? 3 : 2} style={{ textAlign: "center", padding: 12 }}>
                  Chưa có network nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProjectsTab({ projects, reloadMaster, isAdmin }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name) return;
    setLoading(true);
    try {
      if (editing) {
        await api(`/projects/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name,
            description: desc,
            start_date: startDate || null,
            end_date: endDate || null
          })
        });
      } else {
        await api("/projects", {
          method: "POST",
          body: JSON.stringify({
            name,
            description: desc,
            start_date: startDate || null,
            end_date: endDate || null
          })
        });
      }
      setName("");
      setDesc("");
      setStartDate("");
      setEndDate("");
      setEditing(null);
      await reloadMaster();
    } catch (e) {
      alert("Lỗi lưu dự án: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (p) => {
    setEditing(p);
    setName(p.name);
    setDesc(p.description || "");
    setStartDate(p.start_date || "");
    setEndDate(p.end_date || "");
  };

  const cancelEdit = () => {
    setEditing(null);
    setName("");
    setDesc("");
    setStartDate("");
    setEndDate("");
  };

  const del = async (p) => {
    if (!window.confirm(`Xóa dự án "${p.name}"?`)) return;
    try {
      await api(`/projects/${p.id}`, { method: "DELETE" });
      await reloadMaster();
    } catch (e) {
      alert("Lỗi xóa dự án: " + e.message);
    }
  };

  return (
    <>
      {isAdmin && (
        <div className="card">
          <div className="card-title">
            {editing ? `Sửa Dự án: ${editing.name}` : "Thêm Dự án"}
          </div>
          <div className="form-grid mg-top-8">
            <input
              placeholder="Tên dự án"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Mô tả"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <div className="flex gap-8">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="btn-row">
              <button disabled={loading} onClick={save}>
                {editing ? "Lưu" : "Thêm dự án"}
              </button>
              {editing && (
                <button className="secondary" onClick={cancelEdit}>
                  Hủy
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex-between card-header">
          <div className="card-title">Danh sách Dự án</div>
          <span className="badge">{projects.length}</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Mô tả</th>
              <th>Bắt đầu</th>
              <th>Kết thúc</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.description}</td>
                <td>{p.start_date}</td>
                <td>{p.end_date}</td>
                {isAdmin && (
                  <td className="ta-right">
                    <button className="small" onClick={() => startEdit(p)}>
                      Sửa
                    </button>
                    <button className="danger small" onClick={() => del(p)}>
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!projects.length && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: "center", padding: 12 }}>
                  Chưa có dự án nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- root app ---------- */

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("dashboard");

  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFrom = new Date(today.getTime() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const [filterTeamId, setFilterTeamId] = useState("");
  const [filterNetworkId, setFilterNetworkId] = useState("");
  const [filterManagerId, setFilterManagerId] = useState("");

  const filters = { teamId: filterTeamId, networkId: filterNetworkId, managerId: filterManagerId };

  const {
    summary,
    channels,
    teamSummary,
    networkSummary,
    projectSummary,
    loading: dashboardLoading,
    error: dashboardError,
    reload: reloadDashboard
  } = useDashboardData(from, to, filters);

  const [staff, setStaff] = useState([]);
  const [teams, setTeams] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [globalError, setGlobalError] = useState(null);

  const loadMasterData = async (u) => {
    try {
      setGlobalError(null);
      const staffPromise = u.role === "admin" ? api("/staff") : Promise.resolve([]);
      const [staffRes, teamRes, networkRes, projectRes] = await Promise.all([
        staffPromise,
        api("/teams"),
        api("/networks"),
        api("/projects")
      ]);
      setStaff(staffRes || []);
      setTeams(teamRes || []);
      setNetworks(networkRes || []);
      setProjects(projectRes || []);
    } catch (e) {
      setGlobalError(e.message || "Load master data error");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("yt_token");
    const userStr = localStorage.getItem("yt_user");
    if (token && userStr) {
      try {
        const u = JSON.parse(userStr);
        setUser(u);
        reloadDashboard();
        loadMasterData(u);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("yt_token");
    localStorage.removeItem("yt_user");
    setUser(null);
  };

  const handleUpdateChannelMeta = async (ch) => {
    try {
      const id = ch.channel_id ?? ch.id;
      await api(`/channels/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: ch.name,
          network_id: ch.network_id,
          team_id: ch.team_id,
          manager_id: ch.manager_id,
          status: ch.status
        })
      });
      await reloadDashboard();
      await loadMasterData(user);
    } catch (e) {
      alert("Lỗi cập nhật kênh: " + e.message);
    }
  };

  const handleDeleteChannel = async (ch) => {
    if (!window.confirm(`Xóa kênh "${ch.name}"?`)) return;
    try {
      const id = ch.channel_id ?? ch.id;
      await api(`/channels/${id}`, { method: "DELETE" });
      await reloadDashboard();
      await loadMasterData(user);
    } catch (e) {
      alert("Lỗi xóa kênh: " + e.message);
    }
  };

  if (!user) {
    return (
      <Login
        onLoggedIn={(u) => {
          setUser(u);
          reloadDashboard();
          loadMasterData(u);
        }}
      />
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="app-container">
      <TopBar
        user={user}
        onLogout={handleLogout}
        currentTab={tab}
        setTab={setTab}
      />
      {globalError && <div className="card error">Lỗi: {globalError}</div>}

      {tab === "dashboard" && (
        <DashboardTab
          summary={summary}
          channels={channels}
          teamSummary={teamSummary}
          networkSummary={networkSummary}
          projectSummary={projectSummary}
          from={from}
          to={to}
          setFrom={setFrom}
          setTo={setTo}
          filterTeamId={filterTeamId}
          setFilterTeamId={setFilterTeamId}
          filterNetworkId={filterNetworkId}
          setFilterNetworkId={setFilterNetworkId}
          filterManagerId={filterManagerId}
          setFilterManagerId={setFilterManagerId}
          staff={staff}
          teams={teams}
          networks={networks}
          loading={dashboardLoading}
          error={dashboardError}
          reload={reloadDashboard}
        />
      )}

      {tab === "channels" && (
        <ChannelsTable
          title="Quản lý Kênh"
          channels={channels}
          showConnectButton={true}
          isAdmin={isAdmin}
          staffOptions={staff}
          teamOptions={teams}
          networkOptions={networks}
          onUpdateChannelMeta={isAdmin ? handleUpdateChannelMeta : undefined}
          onDelete={isAdmin ? handleDeleteChannel : undefined}
        />
      )}

      {tab === "staff" && (
        <StaffTab
          staff={staff}
          isAdmin={isAdmin}
          reloadMaster={() => loadMasterData(user)}
          channels={channels}
        />
      )}

      {tab === "teams" && (
        <TeamsTab
          teams={teams}
          reloadMaster={() => loadMasterData(user)}
          isAdmin={isAdmin}
        />
      )}

      {tab === "networks" && (
        <NetworksTab
          networks={networks}
          reloadMaster={() => loadMasterData(user)}
          isAdmin={isAdmin}
        />
      )}

      {tab === "projects" && (
        <ProjectsTab
          projects={projects}
          reloadMaster={() => loadMasterData(user)}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}