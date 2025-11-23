import React, { useEffect, useState } from "react";
import {
  Card,
  Tabs,
  Table,
  Typography,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  List,
  Select,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useAuth0 } from "@auth0/auth0-react";
import { createApi } from "../api";
import type { Team, StaffUser } from "../types";

const { Title, Text } = Typography;

const TeamManagement: React.FC = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [teams, setTeams] = useState<Team[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamDetail, setTeamDetail] = useState<{
    team: Team;
    members: StaffUser[];
    channels: string[];
    kpi28d: { totalViews28d: number; totalRevenue28d: number };
  } | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [createTeamForm] = Form.useForm();

  const [addMemberForm] = Form.useForm();
  const [addChannelForm] = Form.useForm();

  const getApi = async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
    });
    return createApi(token);
  };

  const loadTeams = async () => {
    if (!isAuthenticated) return;
    setLoadingTeams(true);
    try {
      const api = await getApi();
      const data = await api.listTeams();
      setTeams(data);
    } catch (e) {
      console.error(e);
      message.error("Không tải được danh sách team.");
    } finally {
      setLoadingTeams(false);
    }
  };

  const loadStaff = async () => {
    if (!isAuthenticated) return;
    setLoadingStaff(true);
    try {
      const api = await getApi();
      const data = await api.listStaff();
      setStaff(data);
    } catch (e) {
      console.error(e);
      message.error("Không tải được danh sách nhân sự.");
    } finally {
      setLoadingStaff(false);
    }
  };

  const loadTeamDetail = async (teamId: number) => {
    try {
      const api = await getApi();
      const detail = await api.getTeam(teamId);
      setTeamDetail(detail);
    } catch (e) {
      console.error(e);
      message.error("Không tải được chi tiết team.");
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadTeams();
      loadStaff();
    }
  }, [isAuthenticated]);

  const handleOpenTeamDetail = (teamId: number) => {
    setSelectedTeamId(teamId);
    setDetailVisible(true);
    loadTeamDetail(teamId);
  };

  const handleCreateTeam = async () => {
    try {
      const values = await createTeamForm.validateFields();
      const api = await getApi();
      await api.createTeam({
        name: values.name,
        description: values.description,
      });
      message.success("Đã tạo team mới.");
      setCreateTeamModalOpen(false);
      createTeamForm.resetFields();
      loadTeams();
    } catch (e) {
      if ((e as any).errorFields) return;
      console.error(e);
      message.error("Không tạo được team.");
    }
  };

  const handleAddMember = async () => {
    if (!teamDetail) return;
    try {
      const values = await addMemberForm.validateFields();
      const api = await getApi();
      await api.addMemberToTeam(teamDetail.team.id, values.userId);
      message.success("Đã thêm member.");
      addMemberForm.resetFields();
      loadTeamDetail(teamDetail.team.id);
    } catch (e) {
      if ((e as any).errorFields) return;
      console.error(e);
      message.error("Không thêm được member.");
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!teamDetail) return;
    try {
      const api = await getApi();
      await api.removeMemberFromTeam(teamDetail.team.id, userId);
      message.success("Đã bỏ member khỏi team.");
      loadTeamDetail(teamDetail.team.id);
    } catch (e) {
      console.error(e);
      message.error("Không xoá được member.");
    }
  };

  const handleAddChannel = async () => {
    if (!teamDetail) return;
    try {
      const values = await addChannelForm.validateFields();
      const api = await getApi();
      await api.addChannelToTeam(teamDetail.team.id, values.channelId);
      message.success("Đã thêm channel.");
      addChannelForm.resetFields();
      loadTeamDetail(teamDetail.team.id);
    } catch (e) {
      if ((e as any).errorFields) return;
      console.error(e);
      message.error("Không thêm được channel.");
    }
  };

  const handleRemoveChannel = async (channelId: string) => {
    if (!teamDetail) return;
    try {
      const api = await getApi();
      await api.removeChannelFromTeam(teamDetail.team.id, channelId);
      message.success("Đã bỏ channel khỏi team.");
      loadTeamDetail(teamDetail.team.id);
    } catch (e) {
      console.error(e);
      message.error("Không xoá được channel.");
    }
  };

  const teamColumns: ColumnsType<Team> = [
    {
      title: "Team",
      dataIndex: "name",
      key: "name",
      render: (text: string, record) => (
        <a onClick={() => handleOpenTeamDetail(record.id)}>{text}</a>
      ),
    },
    {
      title: "Members",
      dataIndex: "membersCount",
      key: "membersCount",
      width: 100,
    },
    {
      title: "Channels",
      dataIndex: "channelsCount",
      key: "channelsCount",
      width: 100,
    },
    {
      title: "Views 28d",
      dataIndex: "totalViews28d",
      key: "totalViews28d",
      width: 140,
      render: (v?: number) => (v || 0).toLocaleString(),
    },
    {
      title: "Revenue 28d",
      dataIndex: "totalRevenue28d",
      key: "totalRevenue28d",
      width: 140,
      render: (v?: number) => (v ?? 0).toFixed(2),
    },
  ];

  const staffColumns: ColumnsType<StaffUser> = [
    {
      title: "Nhân sự",
      dataIndex: "name",
      key: "name",
      render: (_: any, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.email}
          </Text>
        </Space>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 120,
    },
    {
      title: "Open tasks",
      dataIndex: "openTasks",
      key: "openTasks",
      width: 120,
    },
    {
      title: "Published 28d",
      dataIndex: "published28d",
      key: "published28d",
      width: 140,
    },
  ];

  return (
    <>
      <Tabs
        defaultActiveKey="teams"
        items={[
          {
            key: "teams",
            label: "Teams",
            children: (
              <Card
                bordered={false}
                title={<Title level={4} style={{ margin: 0 }}>Danh sách team</Title>}
                extra={
                  <Button type="primary" onClick={() => setCreateTeamModalOpen(true)}>
                    Tạo team
                  </Button>
                }
              >
                <Table<Team>
                  rowKey="id"
                  loading={loadingTeams}
                  dataSource={teams}
                  columns={teamColumns}
                />
              </Card>
            ),
          },
          {
            key: "staff",
            label: "Nhân sự",
            children: (
              <Card
                bordered={false}
                title={<Title level={4} style={{ margin: 0 }}>Danh sách nhân sự</Title>}
              >
                <Table<StaffUser>
                  rowKey="id"
                  loading={loadingStaff}
                  dataSource={staff}
                  columns={staffColumns}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="Tạo team mới"
        open={createTeamModalOpen}
        onCancel={() => setCreateTeamModalOpen(false)}
        onOk={handleCreateTeam}
        okText="Tạo"
      >
        <Form form={createTeamForm} layout="vertical">
          <Form.Item
            label="Tên team"
            name="name"
            rules={[{ required: true, message: "Nhập tên team" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={teamDetail ? `Team: ${teamDetail.team.name}` : "Team"}
        open={detailVisible}
        width={800}
        onCancel={() => setDetailVisible(false)}
        footer={null}
      >
        {!teamDetail ? (
          <Text>Đang tải...</Text>
        ) : (
          <Space align="start" size={24} style={{ width: "100%" }}>
            <div style={{ flex: 1 }}>
              <Title level={5}>Members</Title>
              <List
                size="small"
                dataSource={teamDetail.members}
                renderItem={(m) => (
                  <List.Item
                    actions={[
                      <a key="remove" onClick={() => handleRemoveMember(m.id)}>
                        Xóa
                      </a>,
                    ]}
                  >
                    <Space direction="vertical" size={0}>
                      <Text strong>{m.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {m.email} ({m.role})
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
              <Form
                form={addMemberForm}
                layout="inline"
                style={{ marginTop: 8 }}
                onFinish={handleAddMember}
              >
                <Form.Item
                  name="userId"
                  rules={[{ required: true, message: "Chọn nhân sự" }]}
                >
                  <Select
                    placeholder="Chọn nhân sự"
                    style={{ width: 220 }}
                    options={staff.map((s) => ({
                      label: `${s.name} (${s.email})`,
                      value: s.id,
                    }))}
                  />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    Thêm member
                  </Button>
                </Form.Item>
              </Form>
            </div>

            <div style={{ flex: 1 }}>
              <Title level={5}>Channels</Title>
              <Space wrap>
                {teamDetail.channels.map((ch) => (
                  <Tag
                    key={ch}
                    closable
                    onClose={() => handleRemoveChannel(ch)}
                  >
                    {ch}
                  </Tag>
                ))}
              </Space>
              <Form
                form={addChannelForm}
                layout="inline"
                style={{ marginTop: 8 }}
                onFinish={handleAddChannel}
              >
                <Form.Item
                  name="channelId"
                  rules={[{ required: true, message: "Nhập channel id" }]}
                >
                  <Input placeholder="Channel ID" style={{ width: 220 }} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    Thêm channel
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ marginTop: 16 }}>
                <Title level={5}>KPI 28 ngày</Title>
                <Text>
                  Views:{" "}
                  {teamDetail.kpi28d.totalViews28d.toLocaleString()} — Revenue:{" "}
                  {teamDetail.kpi28d.totalRevenue28d.toFixed(2)}
                </Text>
              </div>
            </div>
          </Space>
        )}
      </Modal>
    </>
  );
};

export default TeamManagement;
