import React, { useEffect, useMemo, useState } from "react";
import {
  Layout,
  Menu,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Space,
  AutoComplete,
  Input,
  Select,
  Button,
  message,
  Spin,
} from "antd";
import {
  BarChartOutlined,
  YoutubeOutlined,
  FilterOutlined,
  ReloadOutlined,
  LoginOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useAuth0 } from "@auth0/auth0-react";
import type {
  DashboardSummary,
  Channel,
  ChannelMaps,
  StaffRankItem,
} from "./types";
import { createApi } from "./api";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;

interface FiltersState {
  manager?: string;
  network?: string;
  project?: string;
  hidden?: "all" | "visible" | "hidden";
  keyword?: string;
}

const App: React.FC = () => {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
    getAccessTokenSilently,
  } = useAuth0();

  const [collapsed, setCollapsed] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [savingMaps, setSavingMaps] = useState(false);
  const [connectingYouTube, setConnectingYouTube] = useState(false);
  const [syncingYouTube, setSyncingYouTube] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [maps, setMaps] = useState<ChannelMaps | null>(null);
  const [filters, setFilters] = useState<FiltersState>({
    hidden: "visible",
  });

  const [messageApi, contextHolder] = message.useMessage();

  // Load data once user is authenticated

  const apiBase =
    (import.meta as any).env?.VITE_API_BASE ||
    (window.location.origin.startsWith("https://dash.")
      ? window.location.origin.replace("dash.", "api.")
      : window.location.origin);

  const handleConnectYouTube = async () => {
    try {
      setConnectingYouTube(true);
      const accessToken = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });
      const res = await fetch(`${apiBase}/api/youtube/auth-url`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to get YouTube auth URL");
      }
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      }
    } catch (err) {
      console.error("handleConnectYouTube error", err);
      // có thể thêm message notification nếu bạn đang dùng antd message
    } finally {
      setConnectingYouTube(false);
    }
  };

  const handleSyncLast30 = async () => {
    const channelId = window.prompt(
      "Nhập YouTube channel ID cần sync (ví dụ: UCxxxxxxxxxx):"
    );
    if (!channelId) return;

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);

    const fmt = (d: Date) =>
      d.toISOString().slice(0, 10); // YYYY-MM-DD

    try {
      setSyncingYouTube(true);
      const accessToken = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const res = await fetch(`${apiBase}/api/youtube/sync-channel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelId,
          startDate: fmt(start),
          endDate: fmt(end),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to sync channel");
      }
      const json = await res.json();
      console.log("Synced rows:", json.rows);
      // có thể gọi lại loadData() nếu bạn muốn cập nhật ngay
    } catch (err) {
      console.error("handleSyncLast30 error", err);
    } finally {
      setSyncingYouTube(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      if (!isAuthenticated) return;
      try {
        setLoadingSummary(true);
        setLoadingChannels(true);

        const accessToken = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          },
        });

        const api = createApi(accessToken);

        const [summaryData, channelsData, mapsData] = await Promise.all([
          api.getDashboardSummary().catch(() => null),
          api.getChannels().catch(() => []),
          api.getChannelMaps().catch(() => null),
        ]);
        if (summaryData) setSummary(summaryData);
        if (channelsData) setChannels(channelsData);
        if (mapsData) setMaps(mapsData);
      } catch (e: any) {
        console.error(e);
        if (e?.error === "login_required" || e?.error === "consent_required") {
          loginWithRedirect();
          return;
        }
        messageApi.error("Không tải được dữ liệu từ server.");
      } finally {
        setLoadingSummary(false);
        setLoadingChannels(false);
      }
    };
    loadAll();
  }, [isAuthenticated, getAccessTokenSilently, loginWithRedirect, messageApi]);

  // Merge channel list with maps (mgr/net/prj/hidden)
  const mergedChannels: Channel[] = useMemo(() => {
    if (!maps) return channels;
    const mgr = maps.mgr || {};
    const net = maps.net || {};
    const prj = maps.prj || {};
    const hidden = maps.hidden || {};
    return channels.map((c) => ({
      ...c,
      manager: mgr[c.id] || "",
      network: net[c.id] || "",
      project: prj[c.id] || "",
      hidden: Boolean(hidden[c.id]),
    }));
  }, [channels, maps]);

  // Unique options for filters
  const managerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          mergedChannels
            .map((c) => c.manager)
            .filter((v): v is string => Boolean(v))
        )
      ).map((value) => ({ value, label: value })),
    [mergedChannels]
  );

  const networkOptions = useMemo(
    () =>
      Array.from(
        new Set(
          mergedChannels
            .map((c) => c.network)
            .filter((v): v is string => Boolean(v))
        )
      ).map((value) => ({ value, label: value })),
    [mergedChannels]
  );

  const projectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          mergedChannels
            .map((c) => c.project)
            .filter((v): v is string => Boolean(v))
        )
      ).map((value) => ({ value, label: value })),
    [mergedChannels]
  );

  const filteredChannels = useMemo(() => {
    return mergedChannels.filter((c) => {
      if (filters.manager && c.manager !== filters.manager) return false;
      if (filters.network && c.network !== filters.network) return false;
      if (filters.project && c.project !== filters.project) return false;
      if (filters.hidden === "visible" && c.hidden) return false;
      if (filters.hidden === "hidden" && !c.hidden) return false;
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        const hay =
          (c.title || "") +
          " " +
          (c.id || "") +
          " " +
          (c.manager || "") +
          " " +
          (c.network || "") +
          " " +
          (c.project || "");
        if (!hay.toLowerCase().includes(kw)) return false;
      }
      return true;
    });
  }, [mergedChannels, filters]);

  const handleMapsChange = (
    channelId: string,
    field: "manager" | "network" | "project" | "hidden",
    value: string | boolean
  ) => {
    if (!maps) {
      setMaps({
        version: 1,
        mgr: {},
        net: {},
        prj: {},
        hidden: {},
      });
      return;
    }
    const next: ChannelMaps = {
      version: maps.version,
      mgr: { ...(maps.mgr || {}) },
      net: { ...(maps.net || {}) },
      prj: { ...(maps.prj || {}) },
      hidden: { ...(maps.hidden || {}) },
    };
    if (field === "manager") {
      if (value) next.mgr[channelId] = String(value);
      else delete next.mgr[channelId];
    }
    if (field === "network") {
      if (value) next.net[channelId] = String(value);
      else delete next.net[channelId];
    }
    if (field === "project") {
      if (value) next.prj[channelId] = String(value);
      else delete next.prj[channelId];
    }
    if (field === "hidden") {
      if (value) next.hidden[channelId] = Boolean(value);
      else delete next.hidden[channelId];
    }
    setMaps(next);
  };

  const handleSaveMaps = async () => {
    if (!maps) return;
    try {
      setSavingMaps(true);

      const accessToken = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });
      const api = createApi(accessToken);

      const updated = await api.saveChannelMaps(maps);
      setMaps(updated);
      messageApi.success("Đã lưu thay đổi mapping kênh.");
    } catch (e: any) {
      console.error(e);
      messageApi.error(
        e?.response?.data?.message ||
          "Không lưu được mapping. Vui lòng thử lại."
      );
    } finally {
      setSavingMaps(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoadingChannels(true);
      const accessToken = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });
      const api = createApi(accessToken);
      const [channelsData, mapsData] = await Promise.all([
        api.getChannels().catch(() => []),
        api.getChannelMaps().catch(() => null),
      ]);
      setChannels(channelsData);
      if (mapsData) setMaps(mapsData);
    } catch (e) {
      console.error(e);
      messageApi.error("Không tải lại được danh sách kênh.");
    } finally {
      setLoadingChannels(false);
    }
  };

  const columns = [
    {
      title: "Kênh",
      dataIndex: "title",
      key: "title",
      render: (_: any, record: Channel) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: "Nhân sự",
      dataIndex: "manager",
      key: "manager",
      width: 200,
      render: (_: any, record: Channel) => (
        <AutoComplete
          style={{ width: "100%" }}
          options={managerOptions}
          value={record.manager || ""}
          placeholder="Nhập hoặc chọn nhân sự"
          onChange={(value) =>
            handleMapsChange(record.id, "manager", value)
          }
          allowClear
          filterOption={(inputValue, option) =>
            (option?.value || "")
              .toLowerCase()
              .includes(inputValue.toLowerCase())
          }
        />
      ),
    },
    {
      title: "Network",
      dataIndex: "network",
      key: "network",
      width: 180,
      render: (_: any, record: Channel) => (
        <AutoComplete
          style={{ width: "100%" }}
          options={networkOptions}
          value={record.network || ""}
          placeholder="Nhập hoặc chọn network"
          onChange={(value) =>
            handleMapsChange(record.id, "network", value)
          }
          allowClear
          filterOption={(inputValue, option) =>
            (option?.value || "")
              .toLowerCase()
              .includes(inputValue.toLowerCase())
          }
        />
      ),
    },
    {
      title: "Dự án",
      dataIndex: "project",
      key: "project",
      width: 180,
      render: (_: any, record: Channel) => (
        <AutoComplete
          style={{ width: "100%" }}
          options={projectOptions}
          value={record.project || ""}
          placeholder="Nhập hoặc chọn dự án"
          onChange={(value) =>
            handleMapsChange(record.id, "project", value)
          }
          allowClear
          filterOption={(inputValue, option) =>
            (option?.value || "")
              .toLowerCase()
              .includes(inputValue.toLowerCase())
          }
        />
      ),
    },
    {
      title: "Ẩn",
      dataIndex: "hidden",
      key: "hidden",
      width: 80,
      align: "center" as const,
      render: (value: boolean, record: Channel) => (
        <Tag
          color={value ? "default" : "success"}
          onClick={() =>
            handleMapsChange(record.id, "hidden", !record.hidden)
          }
          style={{ cursor: "pointer" }}
        >
          {value ? "Ẩn" : "Hiện"}
        </Tag>
      ),
    },
    {
      title: "Views 30d",
      dataIndex: "views30d",
      key: "views30d",
      sorter: (a: Channel, b: Channel) =>
        (a.views30d || 0) - (b.views30d || 0),
      render: (v: number | undefined) =>
        v != null ? v.toLocaleString("en-US") : "-",
      align: "right" as const,
    },
    {
      title: "Revenue 30d",
      dataIndex: "revenue30d",
      key: "revenue30d",
      sorter: (a: Channel, b: Channel) =>
        (a.revenue30d || 0) - (b.revenue30d || 0),
      render: (v: number | undefined) =>
        v != null ? `$${v.toFixed(2)}` : "-",
      align: "right" as const,
    },
    {
      title: "RPM",
      dataIndex: "rpm",
      key: "rpm",
      sorter: (a: Channel, b: Channel) => (a.rpm || 0) - (b.rpm || 0),
      render: (v: number | undefined) =>
        v != null ? `$${v.toFixed(2)}` : "-",
      align: "right" as const,
    },
  ];

  const staffRanking: StaffRankItem[] = summary?.staffRanking || [];

  // Global loading (Auth0)
  if (isLoading) {
    return (
      <div className="fullpage-center">
        <Spin size="large" />
      </div>
    );
  }

  // Not authenticated: show login screen
  if (!isAuthenticated) {
    return (
      <div className="fullpage-center">
        <Card
          bordered={false}
          style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
        >
          <Title level={4}>Đăng nhập để xem Dashboard</Title>
          <Text type="secondary">
            Bạn cần đăng nhập bằng tài khoản được cấp quyền để xem dữ liệu doanh thu.
          </Text>
          <div style={{ marginTop: 24 }}>
            <Button
              type="primary"
              icon={<LoginOutlined />}
              onClick={() => loginWithRedirect()}
            >
              Đăng nhập
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Layout className="app-layout">
      {contextHolder}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        className="app-sider"
      >
        <div className="app-logo">
          <span className="app-logo-dot" />
          <span className="app-logo-text">
            {collapsed ? "TS" : "The Sun Media"}
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["dashboard"]}
          items={[
            {
              key: "dashboard",
              icon: <BarChartOutlined />,
              label: "Dashboard",
            },
            {
              key: "channels",
              icon: <YoutubeOutlined />,
              label: "Quản lý kênh",
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div className="app-header-left">
            <Title level={4} style={{ margin: 0 }}>
              YouTube Revenue Dashboard
            </Title>
            <Text type="secondary">
              Theo dõi doanh thu, RPM và quản lý mapping kênh.
            </Text>
          </div>
          
          <div className="app-header-right">
            <Space size="middle">
              <Button
                type="default"
                onClick={handleConnectYouTube}
                loading={connectingYouTube}
              >
                Kết nối YouTube
              </Button>
              <Button
                type="default"
                onClick={handleSyncLast30}
                loading={syncingYouTube}
              >
                Sync 30 ngày gần nhất
              </Button>
              <div className="user-pill">
                <div className="user-avatar">
                  {(user?.name || user?.email || "TS")
                    .toString()
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="user-meta">
                  <div className="user-name">
                    {user?.name || user?.email || "User"}
                  </div>
                  <div className="user-role">YouTube Ops</div>
                </div>
              </div>
              <Button
                type="link"
                icon={<LogoutOutlined />}
                onClick={() =>
                  logout({
                    logoutParams: { returnTo: window.location.origin },
                  })
                }
              >
                Đăng xuất
              </Button>
            </Space>
          </div>
</Header>
        <Content className="app-content">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Card className="metric-card" bordered={false}>
                    <Statistic
                      title="Tổng doanh thu (30 ngày)"
                      prefix="$"
                      precision={2}
                      value={summary?.totalRevenue || 0}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Dữ liệu tổng hợp từ yt_daily_revenue
                    </Text>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card className="metric-card" bordered={false}>
                    <Statistic
                      title="Tổng views (30 ngày)"
                      value={summary?.totalViews30d || 0}
                      valueStyle={{ fontWeight: 600 }}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Tổng lượt xem trên toàn bộ kênh
                    </Text>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card className="metric-card" bordered={false}>
                    <Statistic
                      title="RPM trung bình (30 ngày)"
                      prefix="$"
                      precision={2}
                      value={summary?.avgRpm || 0}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Doanh thu trên 1.000 views
                    </Text>
                  </Card>
                </Col>
              </Row>
            </Col>

            <Col xs={24} lg={16}>
              <Card
                bordered={false}
                className="chart-card"
                title={
                  <Space>
                    <BarChartOutlined />
                    <span>Biểu đồ doanh thu 30 ngày</span>
                  </Space>
                }
              >
                {loadingSummary ? (
                  <div className="chart-loading">
                    <Spin />
                  </div>
                ) : summary && summary.revenueSeries.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={summary.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#1677ff"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Text type="secondary">
                    Chưa có dữ liệu doanh thu để hiển thị.
                  </Text>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card
                bordered={false}
                className="leaderboard-card"
                title="Top nhân sự theo doanh thu"
              >
                {staffRanking.length ? (
                  <div className="leaderboard-list">
                    {staffRanking.map((s, idx) => (
                      <div className="leaderboard-item" key={s.name}>
                        <div className="leaderboard-rank">
                          {idx + 1}
                        </div>
                        <div className="leaderboard-name">{s.name}</div>
                        <div className="leaderboard-value">
                          ${s.revenue.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary">
                    Chưa có mapping Nhân sự → Kênh hoặc chưa có dữ liệu
                    doanh thu.
                  </Text>
                )}
              </Card>
            </Col>

            <Col span={24}>
              <Card
                bordered={false}
                className="table-card"
                title={
                  <Space>
                    <FilterOutlined />
                    <span>Quản lý kênh YouTube</span>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={handleRefresh}
                    >
                      Refresh
                    </Button>
                    <Button
                      type="primary"
                      loading={savingMaps}
                      onClick={handleSaveMaps}
                    >
                      Lưu thay đổi
                    </Button>
                  </Space>
                }
              >
                <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                  <Col xs={24} md={6}>
                    <AutoComplete
                      allowClear
                      style={{ width: "100%" }}
                      options={managerOptions}
                      placeholder="Lọc theo Nhân sự"
                      value={filters.manager}
                      onChange={(value) =>
                        setFilters((f) => ({ ...f, manager: value || undefined }))
                      }
                      filterOption={(inputValue, option) =>
                        (option?.value || "")
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <AutoComplete
                      allowClear
                      style={{ width: "100%" }}
                      options={networkOptions}
                      placeholder="Lọc theo Network"
                      value={filters.network}
                      onChange={(value) =>
                        setFilters((f) => ({ ...f, network: value || undefined }))
                      }
                      filterOption={(inputValue, option) =>
                        (option?.value || "")
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <AutoComplete
                      allowClear
                      style={{ width: "100%" }}
                      options={projectOptions}
                      placeholder="Lọc theo Dự án"
                      value={filters.project}
                      onChange={(value) =>
                        setFilters((f) => ({ ...f, project: value || undefined }))
                      }
                      filterOption={(inputValue, option) =>
                        (option?.value || "")
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <Select
                      style={{ width: "100%" }}
                      value={filters.hidden || "visible"}
                      onChange={(value) =>
                        setFilters((f) => ({ ...f, hidden: value }))
                      }
                      options={[
                        { value: "all", label: "Tất cả kênh" },
                        { value: "visible", label: "Chỉ kênh đang hiện" },
                        { value: "hidden", label: "Chỉ kênh đang ẩn" },
                      ]}
                    />
                  </Col>
                  <Col xs={24}>
                    <Search
                      allowClear
                      placeholder="Tìm theo tên kênh, ID, nhân sự, network..."
                      onSearch={(value) =>
                        setFilters((f) => ({ ...f, keyword: value || undefined }))
                      }
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          keyword: e.target.value || undefined,
                        }))
                      }
                    />
                  </Col>
                </Row>
                <Table
                  rowKey="id"
                  loading={loadingChannels}
                  dataSource={filteredChannels}
                  columns={columns as any}
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: false,
                  }}
                  scroll={{ x: 900 }}
                />
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
