
import YouTubeSyncPanel from "./YouTubeSyncPanel";
import React, { useEffect, useState } from "react";
import {
  Card,
  DatePicker,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  Table,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { useAuth0 } from "@auth0/auth0-react";
import { createApi } from "../api";
import type {
  CompanyReport,
  TeamReportItem,
  TalentReportItem,
} from "../types";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const ReportsDashboard: React.FC = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => {
    const end = dayjs();
    const start = end.subtract(28, "day");
    return [start, end];
  });

  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<CompanyReport | null>(null);
  const [teamReport, setTeamReport] = useState<TeamReportItem[]>([]);
  const [talentReport, setTalentReport] = useState<TalentReportItem[]>([]);

  const getApi = async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
    });
    return createApi(token);
  };

  const loadReports = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const api = await getApi();
      const startDate = range[0].format("YYYY-MM-DD");
      const endDate = range[1].add(1, "day").format("YYYY-MM-DD");

      const [companyRes, teamRes, talentRes] = await Promise.all([
        api.getCompanyReport({ startDate, endDate }),
        api.getTeamReport({ startDate, endDate }),
        api.getTalentReport({ startDate, endDate }),
      ]);

      setCompany(companyRes);
      setTeamReport(teamRes.teams);
      setTalentReport(talentRes.talents);
    } catch (e) {
      console.error(e);
      message.error("Không tải được báo cáo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadReports();
    }
  }, [isAuthenticated]);

  const teamColumns: ColumnsType<TeamReportItem> = [
    {
      title: "Team",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Channels",
      dataIndex: "channelsCount",
      key: "channelsCount",
      width: 100,
    },
    {
      title: "Views",
      dataIndex: "totalViews",
      key: "totalViews",
      width: 140,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: "Revenue",
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      width: 140,
      render: (v: number) => v.toFixed(2),
    },
  ];

  const talentColumns: ColumnsType<TalentReportItem> = [
    {
      title: "Talent",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Rev share",
      dataIndex: "revSharePercent",
      key: "revSharePercent",
      width: 120,
      render: (v: number) => `${v}%`,
    },
    {
      title: "Channels",
      dataIndex: "channelsCount",
      key: "channelsCount",
      width: 100,
    },
    {
      title: "Views",
      dataIndex: "totalViews",
      key: "totalViews",
      width: 140,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: "Revenue",
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      width: 140,
      render: (v: number) => v.toFixed(2),
    },
  ];

  const handleRangeChange = (value: null | [Dayjs, Dayjs]) => {
    if (!value) return;
    setRange(value);
  };

  const handleRefresh = () => {
    loadReports();
  };

  return (
    <>
      <Space
        style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Reports & Company Overview
          </Title>
          <Text type="secondary">
            Tổng quan view & doanh thu toàn network, theo team & talent
          </Text>
        </div>

        <Space>
          <RangePicker
            value={range}
            onChange={handleRangeChange}
            allowClear={false}
          />
          <a onClick={handleRefresh}>{loading ? "Loading..." : "Refresh"}</a>
        </Space>
      </Space>

      {/* Panel YouTube: Kết nối & Sync 30 ngày gần nhất */}
      <YouTubeSyncPanel />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="Tổng views"
              value={company?.summary.totalViews ?? 0}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="Tổng revenue (ước tính)"
              value={company?.summary.totalRevenue ?? 0}
              precision={2}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="Số kênh"
              value={company?.summary.totalChannels ?? 0}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title="Team performance"
            bordered={false}
            loading={loading && !teamReport.length}
          >
            <Table<TeamReportItem>
              rowKey="teamId"
              size="small"
              pagination={false}
              dataSource={teamReport}
              columns={teamColumns}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title="Talent performance"
            bordered={false}
            loading={loading && !talentReport.length}
          >
            <Table<TalentReportItem>
              rowKey="talentId"
              size="small"
              pagination={false}
              dataSource={talentReport}
              columns={talentColumns}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default ReportsDashboard;
