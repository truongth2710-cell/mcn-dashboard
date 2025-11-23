import React, { useEffect, useState } from "react";
import { Layout, Menu, Spin, Typography, Button } from "antd";
import {
  PieChartOutlined,
  ProjectOutlined,
  ApartmentOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useAuth0 } from "@auth0/auth0-react";
import { createApi } from "./api";
import type { StaffUser } from "./types";

import ReportsDashboard from "./components/ReportsDashboard";
import TeamManagement from "./components/TeamManagement";
import AdminUsers from "./components/AdminUsers";
import ProjectBoard from "./components/ProjectBoard";
import TalentCenter from "./components/TalentCenter";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const roleRank = ["viewer", "editor", "channel_manager", "team_lead", "director", "admin"];

const App: React.FC = () => {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, getAccessTokenSilently, user } =
    useAuth0();
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string>("reports");
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const hasRoleAtLeast = (minRole: string) => {
    if (!currentUser) return false;
    const u = roleRank.indexOf(currentUser.role);
    const m = roleRank.indexOf(minRole);
    return u >= 0 && m >= 0 && u >= m;
  };

  const menuConfig = [
    { key: "reports", label: "Reports / Company", icon: <PieChartOutlined />, minRole: "viewer" },
    { key: "projects", label: "Production / Projects", icon: <ProjectOutlined />, minRole: "editor" },
    { key: "teams", label: "Team & Nhân sự", icon: <ApartmentOutlined />, minRole: "team_lead" },
    { key: "talents", label: "Talent / Network", icon: <TeamOutlined />, minRole: "director" },
    { key: "admin-users", label: "Admin / Users", icon: <SettingOutlined />, minRole: "admin" },
  ];

  const allowedMenuItems = menuConfig
    .filter((item) => hasRoleAtLeast(item.minRole))
    .map((item) => ({
      key: item.key,
      label: item.label,
      icon: item.icon,
    }));

  const canView = (key: string) => {
    const cfg = menuConfig.find((m) => m.key === key);
    if (!cfg) return false;
    return hasRoleAtLeast(cfg.minRole);
  };

  useEffect(() => {
    const loadMe = async () => {
      if (!isAuthenticated) {
        setCurrentUser(null);
        setLoadingUser(false);
        return;
      }
      try {
        setLoadingUser(true);
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          },
        });
        const api = createApi(token);
        const me = await api.getCurrentUser();
        setCurrentUser(me);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingUser(false);
      }
    };
    loadMe();
  }, [isAuthenticated, getAccessTokenSilently]);

  if (isLoading || loadingUser) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Spin style={{ margin: "auto" }} />
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Content style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <Title level={3}>MCN Dashboard</Title>
            <Button type="primary" onClick={() => loginWithRedirect()}>
              Đăng nhập
            </Button>
          </div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(v) => setCollapsed(v)}>
        <div
          style={{
            height: 48,
            margin: 8,
            background: "rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          {collapsed ? "MCN" : "MCN Dashboard"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeMenu]}
          items={allowedMenuItems}
          onClick={({ key }) => setActiveMenu(key as string)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            {menuConfig.find((m) => m.key === activeMenu)?.label || "MCN Dashboard"}
          </Title>
          <div>
            <span style={{ marginRight: 16 }}>
              {currentUser?.name || user?.name} ({currentUser?.role})
            </span>
            <Button
              size="small"
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            >
              Đăng xuất
            </Button>
          </div>
        </Header>
        <Content style={{ padding: 16 }}>
          {activeMenu === "reports" && canView("reports") && <ReportsDashboard />}
          {activeMenu === "projects" && canView("projects") && <ProjectBoard />}
          {activeMenu === "teams" && canView("teams") && <TeamManagement />}
          {activeMenu === "talents" && canView("talents") && <TalentCenter />}
          {activeMenu === "admin-users" && canView("admin-users") && <AdminUsers />}

          {!canView(activeMenu) && (
            <div style={{ padding: 24 }}>
              <Title level={4}>Không có quyền truy cập</Title>
              <p>Liên hệ admin để được cấp quyền phù hợp.</p>
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
