// frontend/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";

function formatNumber(n) {
  return (n || 0).toLocaleString("en-US");
}

function useDashboardData(from, to) {
  const [summary, setSummary] = useState(null);
  const [channels, setChannels] = useState([]);
  const [teamSummary, setTeamSummary] = useState([]);
  const [networkSummary, setNetworkSummary] = useState([]);
  const [projectSummary, setProjectSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = `?from=${from}&to=${to}`;
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
      setError(e.message);
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
    reload: load
  };
}

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
      setError(e.message);
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
      setError(e.message);
    }
  };

  return (
    <div className="full-center">
      <div className="card login-card">
        <h2>Đăng nhập / Đăng ký</h2>
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

/* ---------------- DASHBOARD ---------------- */

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
          <div className="label">Tổng revenue</div>
          <div className="value-lg">{formatNumber(summary?.totalRevenue)}</div>
        </div>
        <div className="kpi">
          <div className="label">Watch time (phút)</div>
          <div className="value-lg">{formatNumber(summary?.totalWatchTime)}</div>
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

function ChannelsTable({
  channels,
  showConnectButton,
  isAdmin,
  staffOptions,
  teamOptions,
  networkOptions,
  onUpdateChannelMeta
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return channels;
    const s = search.toLowerCase();
    return channels.filter(
      (ch) =>
        ch.name?.toLowerCase().includes(s) ||
        ch.youtube_channel_id?.toLowerCase().includes(s)
    );
  }, [channels, search]);

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
    onUpdateChannelMeta({
      ...ch,
      [field]: value ? Number(value) : null
    });
  };

  return (
    <div className="card">
      <div className="flex-between card-header">
        <div className="card-title">Kênh</div>
        <div className="flex gap-8 align-center">
          <input
            className="search-input"
            placeholder="Tìm theo tên kênh / ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {showConnectButton && (
            <button onClick={handleConnect}>Kết nối kênh YouTube</button>
          )}
          <span className="badge">{channels.length} kênh</span>
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
            <th className="ta-right">Views</th>
            <th className="ta-right">Revenue</th>
            <th className="ta-right">RPM</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((ch) => (
            <tr key={ch.channel_id || ch.id}>
              <td>{ch.name}</td>
              <td>{ch.youtube_channel_id}</td>
              <td>
                {isAdmin && networkOptions?.length ? (
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
                {isAdmin && teamOptions?.length ? (
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
                {isAdmin && staffOptions?.length ? (
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
              <td className="ta-right">{formatNumber(ch.views)}</td>
              <td className="ta-right">{formatNumber(ch.revenue)}</td>
              <td className="ta-right">{(ch.rpm || 0).toFixed(2)}</td>
            </tr>
          ))}
          {!filtered.length && (
            <tr>
              <td colSpan={8} style={{ textAlign: "center", padding: "16px" }}>
                Chưa có kênh nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

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
                <td key={c.key} className={c.align === "right" ? "ta-right" : ""}>
                  {c.format ? c.format(row[c.key], row) : row[c.key]}
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
  loading,
  reload
}) {
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
          <button onClick={reload}>Cập nhật</button>
        </div>
        {loading && <span className="muted">Đang tải dữ liệu...</span>}
      </div>

      <SummaryCards summary={summary} />
      <ChannelsTable channels={channels} showConnectButton={false} />

      <div className="grid grid-3">
        <SimpleListCard
          title="Theo Team"
          items={teamSummary}
          columns={[
            { key: "team_name", label: "Team" },
            { key: "views", label: "Views", align: "right", format: formatNumber },
            { key: "revenue", label: "Revenue", align: "right", format: formatNumber }
          ]}
        />
        <SimpleListCard
          title="Theo Network"
          items={networkSummary}
          columns={[
            { key: "network_name", label: "Network" },
            { key: "views", label: "Views", align: "right", format: formatNumber },
            { key: "revenue", label: "Revenue", align: "right", format: formatNumber }
          ]}
        />
        <SimpleListCard
          title="Theo Dự án"
          items={projectSummary}
          columns={[
            { key: "project_name", label: "Dự án" },
            { key: "views", label: "Views", align: "right", format: formatNumber },
            { key: "revenue", label: "Revenue", align: "right", format: formatNumber }
          ]}
        />
      </div>
    </>
  );
}

/* ---------------- MANAGEMENT TABS ---------------- */

function StaffTab({ staff, isAdmin }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createStaff = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, name: name || email, password, role })
      });
      setEmail("");
      setName("");
      setPassword("");
      setRole("viewer");
      // không tự reload, để admin F5 / load lại app hoặc bạn có thể thêm hook riêng
      alert("Tạo nhân sự thành công. Người đó có thể đăng nhập bằng email/mật khẩu bạn vừa tạo.");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
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
              {error && <span className="error-inline">{error}</span>}
            </div>
          </div>
        </div>
      )}

      <SimpleListCard
        title="Danh sách nhân sự"
        items={staff}
        columns={[
          { key: "name", label: "Tên" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role" }
        ]}
        emptyLabel="Chưa có nhân sự nào."
      />
    </>
  );
}

function TeamsTab({ teams, reload }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!name) return;
    setLoading(true);
    try {
      await api("/teams", {
        method: "POST",
        body: JSON.stringify({ name, description: desc })
      });
      setName("");
      setDesc("");
      reload && reload();
    } catch (e) {
      alert("Lỗi tạo team: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-title">Thêm Team</div>
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
            <button disabled={loading} onClick={create}>
              Thêm team
            </button>
          </div>
        </div>
      </div>

      <SimpleListCard
        title="Danh sách Team"
        items={teams}
        columns={[
          { key: "name", label: "Tên team" },
          { key: "description", label: "Mô tả" }
        ]}
      />
    </>
  );
}

function NetworksTab({ networks, reload }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!name) return;
    setLoading(true);
    try {
      await api("/networks", {
        method: "POST",
        body: JSON.stringify({ name, description: desc })
      });
      setName("");
      setDesc("");
      reload && reload();
    } catch (e) {
      alert("Lỗi tạo network: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-title">Thêm Network</div>
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
            <button disabled={loading} onClick={create}>
              Thêm network
            </button>
          </div>
        </div>
      </div>

      <SimpleListCard
        title="Danh sách Network"
        items={networks}
        columns={[
          { key: "name", label: "Tên" },
          { key: "description", label: "Mô tả" }
        ]}
      />
    </>
  );
}

function ProjectsTab({ projects, reload }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!name) return;
    setLoading(true);
    try {
      await api("/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: desc,
          start_date: startDate || null,
          end_date: endDate || null
        })
      });
      setName("");
      setDesc("");
      setStartDate("");
      setEndDate("");
      reload && reload();
    } catch (e) {
      alert("Lỗi tạo dự án: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-title">Thêm Dự án</div>
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
            <button disabled={loading} onClick={create}>
              Thêm dự án
            </button>
          </div>
        </div>
      </div>

      <SimpleListCard
        title="Danh sách Dự án"
        items={projects}
        columns={[
          { key: "name", label: "Tên" },
          { key: "description", label: "Mô tả" },
          { key: "start_date", label: "Bắt đầu" },
          { key: "end_date", label: "Kết thúc" }
        ]}
      />
    </>
  );
}

/* ---------------- ROOT APP ---------------- */

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("dashboard");

  // khoảng ngày dashboard
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFrom = new Date(today.getTime() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const {
    summary,
    channels,
    teamSummary,
    networkSummary,
    projectSummary,
    loading: dashboardLoading,
    error: dashboardError,
    reload: reloadDashboard
  } = useDashboardData(from, to);

  const [staff, setStaff] = useState([]);
  const [teams, setTeams] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [globalError, setGlobalError] = useState(null);

  const loadMasterData = async (u) => {
    try {
      setGlobalError(null);
      const [staffRes, teamRes, networkRes, projectRes] = await Promise.all([
        u.role === "admin" ? api("/staff") : Promise.resolve([]),
        api("/teams"),
        api("/networks"),
        api("/projects")
      ]);
      setStaff(staffRes || []);
      setTeams(teamRes || []);
      setNetworks(networkRes || []);
      setProjects(projectRes || []);
    } catch (e) {
      setGlobalError(e.message);
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
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("yt_token");
    localStorage.removeItem("yt_user");
    setUser(null);
  };

  const handleUpdateChannelMeta = async (ch) => {
    try {
      await api(`/channels/${ch.channel_id || ch.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: ch.name,
          network_id: ch.network_id,
          team_id: ch.team_id,
          manager_id: ch.manager_id,
          status: ch.status
        })
      });
      // reload lại dashboard để số summary theo team/network cập nhật
      reloadDashboard();
    } catch (e) {
      alert("Lỗi cập nhật kênh: " + e.message);
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
          loading={dashboardLoading}
          reload={reloadDashboard}
        />
      )}

      {tab === "channels" && (
        <ChannelsTable
          channels={channels}
          showConnectButton={true}
          isAdmin={user.role === "admin"}
          staffOptions={staff}
          teamOptions={teams}
          networkOptions={networks}
          onUpdateChannelMeta={user.role === "admin" ? handleUpdateChannelMeta : null}
        />
      )}

      {tab === "staff" && (
        <StaffTab staff={staff} isAdmin={user.role === "admin"} />
      )}

      {tab === "teams" && (
        <TeamsTab
          teams={teams}
          reload={() => loadMasterData(user)}
        />
      )}

      {tab === "networks" && (
        <NetworksTab
          networks={networks}
          reload={() => loadMasterData(user)}
        />
      )}

      {tab === "projects" && (
        <ProjectsTab
          projects={projects}
          reload={() => loadMasterData(user)}
        />
      )}
    </div>
  );
}
