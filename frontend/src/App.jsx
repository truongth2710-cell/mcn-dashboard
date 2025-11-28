import React, { useEffect, useState } from "react";
import { api } from "./api";

function formatNumber(n) {
  return (n || 0).toLocaleString("en-US");
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
    <div className="card">
      <h2>Đăng nhập / Đăng ký</h2>
      <div className="form-grid">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="text"
          placeholder="Tên (khi đăng ký)"
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
  );
}

function TopBar({ user, onLogout, currentTab, setTab }) {
  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "staff", label: "Nhân sự" },
    { key: "channels", label: "Kênh" },
    { key: "teams", label: "Team" },
    { key: "networks", label: "Network" },
    { key: "projects", label: "Dự án" }
  ];
  return (
    <div className="card flex-between">
      <div className="flex gap-16">
        <h2>Sun Media YouTube Dashboard</h2>
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
      <div className="flex gap-8">
        <span>
          {user?.name} (<strong>{user?.role}</strong>)
        </span>
        <button className="secondary" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

function SummaryCards({ summary }) {
  return (
    <div className="card">
      <div className="card-title">Tổng quan</div>
      <div className="grid grid-4">
        <div>
          <div className="label">Tổng views</div>
          <div className="value-lg">{formatNumber(summary?.totalViews)}</div>
        </div>
        <div>
          <div className="label">Tổng revenue</div>
          <div className="value-lg">{formatNumber(summary?.totalRevenue)}</div>
        </div>
        <div>
          <div className="label">Watch time (phút)</div>
          <div className="value-lg">{formatNumber(summary?.totalWatchTime)}</div>
        </div>
        <div>
          <div className="label">RPM trung bình</div>
          <div className="value-lg">
            {summary ? summary.avgRPM.toFixed(2) : "0.00"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelsTable({ channels, showConnectButton }) {
  const handleConnect = async () => {
    try {
      const res = await api("/youtube/connect-url");
      window.location.href = res.url;
    } catch (e) {
      alert("Không lấy được link kết nối: " + e.message);
    }
  };

  return (
    <div className="card">
      <div className="flex-between">
        <div className="card-title">Kênh</div>
        <div className="flex gap-8">
          {showConnectButton && (
            <button onClick={handleConnect}>Kết nối kênh YouTube</button>
          )}
          <span className="badge">{channels.length} kênh</span>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Kênh</th>
            <th>YouTube ID</th>
            <th>Network</th>
            <th>Team</th>
            <th>Manager</th>
            <th>Views</th>
            <th>Revenue</th>
            <th>RPM</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((ch) => (
            <tr key={ch.channel_id || ch.id}>
              <td>{ch.name}</td>
              <td>{ch.youtube_channel_id}</td>
              <td>{ch.network_name || ch.network}</td>
              <td>{ch.team_name || ch.team}</td>
              <td>{ch.manager_name || ch.manager}</td>
              <td>{formatNumber(ch.views)}</td>
              <td>{formatNumber(ch.revenue)}</td>
              <td>{(ch.rpm || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleListCard({ title, items, columns }) {
  return (
    <div className="card">
      <div className="flex-between">
        <div className="card-title">{title}</div>
        <div>
          <span className="badge">{items.length}</span>
        </div>
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
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key}>{row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardTab({ summary, channels, teamSummary, networkSummary, projectSummary }) {
  return (
    <>
      <SummaryCards summary={summary} />
      <ChannelsTable channels={channels} showConnectButton={false} />
      <div className="grid grid-3">
        <SimpleListCard
          title="Theo Team"
          items={teamSummary}
          columns={[
            { key: "team_name", label: "Team" },
            { key: "views", label: "Views" },
            { key: "revenue", label: "Revenue" }
          ]}
        />
        <SimpleListCard
          title="Theo Network"
          items={networkSummary}
          columns={[
            { key: "network_name", label: "Network" },
            { key: "views", label: "Views" },
            { key: "revenue", label: "Revenue" }
          ]}
        />
        <SimpleListCard
          title="Theo Dự án"
          items={projectSummary}
          columns={[
            { key: "project_name", label: "Dự án" },
            { key: "views", label: "Views" },
            { key: "revenue", label: "Revenue" }
          ]}
        />
      </div>
    </>
  );
}

function StaffTab({ staff }) {
  return (
    <SimpleListCard
      title="Nhân sự"
      items={staff}
      columns={[
        { key: "name", label: "Tên" },
        { key: "email", label: "Email" },
        { key: "role", label: "Role" }
      ]}
    />
  );
}

function TeamsTab({ teams }) {
  return (
    <SimpleListCard
      title="Team"
      items={teams}
      columns={[
        { key: "name", label: "Tên team" },
        { key: "description", label: "Mô tả" }
      ]}
    />
  );
}

function NetworksTab({ networks }) {
  return (
    <SimpleListCard
      title="Network"
      items={networks}
      columns={[
        { key: "name", label: "Tên" },
        { key: "description", label: "Mô tả" }
      ]}
    />
  );
}

function ProjectsTab({ projects }) {
  return (
    <SimpleListCard
      title="Dự án"
      items={projects}
      columns={[
        { key: "name", label: "Tên" },
        { key: "description", label: "Mô tả" },
        { key: "start_date", label: "Bắt đầu" },
        { key: "end_date", label: "Kết thúc" }
      ]}
    />
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [summary, setSummary] = useState(null);
  const [channels, setChannels] = useState([]);
  const [teamSummary, setTeamSummary] = useState([]);
  const [networkSummary, setNetworkSummary] = useState([]);
  const [projectSummary, setProjectSummary] = useState([]);
  const [staff, setStaff] = useState([]);
  const [teams, setTeams] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const [s, c, ts, ns, ps] = await Promise.all([
        api("/dashboard/summary"),
        api("/dashboard/channels"),
        api("/dashboard/team-summary"),
        api("/dashboard/network-summary"),
        api("/dashboard/project-summary")
      ]);
      setSummary(s);
      setChannels(c);
      setTeamSummary(ts);
      setNetworkSummary(ns);
      setProjectSummary(ps);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadMasterData = async () => {
    try {
      setError(null);
      const [staffRes, teamRes, networkRes, projectRes] = await Promise.all([
        user?.role === "admin" ? api("/staff") : Promise.resolve([]),
        api("/teams"),
        api("/networks"),
        api("/projects")
      ]);
      setStaff(staffRes || []);
      setTeams(teamRes || []);
      setNetworks(networkRes || []);
      setProjects(projectRes || []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("yt_token");
    const userStr = localStorage.getItem("yt_user");
    if (token && userStr) {
      try {
        const u = JSON.parse(userStr);
        setUser(u);
        loadDashboardData();
        loadMasterData();
      } catch {
        // ignore
      }
    }
  }, []);

  // Nếu được redirect từ /youtube-connected, show thông báo
  useEffect(() => {
    if (window.location.pathname.includes("youtube-connected")) {
      setInfo("Kết nối YouTube thành công. Đang tải lại dữ liệu kênh...");
      // reload dữ liệu kênh
      loadDashboardData();
      // optional: có thể dùng history.replaceState để xóa path, nhưng để đơn giản mình giữ nguyên.
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("yt_token");
    localStorage.removeItem("yt_user");
    setUser(null);
  };

  if (!user) {
    return (
      <div className="app-container">
        <Login
          onLoggedIn={(u) => {
            setUser(u);
            loadDashboardData();
            loadMasterData();
          }}
        />
      </div>
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
      {error && <div className="card error">Lỗi: {error}</div>}
      {info && <div className="card info">{info}</div>}

      {tab === "dashboard" && (
        <DashboardTab
          summary={summary}
          channels={channels}
          teamSummary={teamSummary}
          networkSummary={networkSummary}
          projectSummary={projectSummary}
        />
      )}
      {tab === "staff" && <StaffTab staff={staff} />}
      {tab === "channels" && (
        <ChannelsTable channels={channels} showConnectButton={true} />
      )}
      {tab === "teams" && <TeamsTab teams={teams} />}
      {tab === "networks" && <NetworksTab networks={networks} />}
      {tab === "projects" && <ProjectsTab projects={projects} />}
    </div>
  );
}
