import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Space,
  Typography,
  Button,
  message,
  Select,
  Switch,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useAuth0 } from "@auth0/auth0-react";
import { createApi } from "../api";
import type { StaffUser, StaffRole } from "../types";

const { Title, Text } = Typography;

const ROLE_OPTIONS: StaffRole[] = [
  "admin",
  "director",
  "team_lead",
  "channel_manager",
  "editor",
  "viewer",
];

const AdminUsers: React.FC = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const getApi = async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
    });
    return createApi(token);
  };

  const loadUsers = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const api = await getApi();
      const data = await api.listStaff();
      setUsers(data);
    } catch (e) {
      console.error(e);
      message.error("Không tải được danh sách user.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [isAuthenticated]);

  const handleChangeRole = async (user: StaffUser, role: StaffRole) => {
    setUpdatingId(user.id);
    try {
      const api = await getApi();
      await api.updateStaff(user.id, { role });
      message.success(`Đã đổi role của ${user.name} thành ${role}.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role } : u))
      );
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error?.message || "Không đổi được role.";
      message.error(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (user: StaffUser, active: boolean) => {
    setUpdatingId(user.id);
    try {
      const api = await getApi();
      await api.updateStaff(user.id, { active });
      message.success(
        `${active ? "Đã mở" : "Đã khóa"} tài khoản ${user.name}.`
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, active } : u))
      );
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error?.message || "Không cập nhật được trạng thái.";
      message.error(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const columns: ColumnsType<StaffUser> = [
    {
      title: "User",
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
      width: 220,
      render: (role: StaffRole, record) => (
        <Select
          value={role}
          style={{ width: "100%" }}
          onChange={(val) => handleChangeRole(record, val as StaffRole)}
          disabled={updatingId === record.id}
          options={ROLE_OPTIONS.map((r) => ({
            label: r,
            value: r,
          }))}
        />
      ),
    },
    {
      title: "Active",
      dataIndex: "active",
      key: "active",
      width: 120,
      render: (active: boolean, record) => (
        <Switch
          checked={active}
          onChange={(checked) => handleToggleActive(record, checked)}
          disabled={updatingId === record.id}
        />
      ),
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
    {
      title: "Created at",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (v?: string) => (v ? new Date(v).toLocaleString() : "-"),
    },
  ];

  return (
    <Card
      bordered={false}
      title={<Title level={4} style={{ margin: 0 }}>Admin / Users</Title>}
      extra={
        <Button onClick={loadUsers} loading={loading}>
          Refresh
        </Button>
      }
    >
      <Table<StaffUser>
        rowKey="id"
        loading={loading}
        dataSource={users}
        columns={columns}
      />
      <Text type="secondary" style={{ fontSize: 12 }}>
        Chỉ admin mới đổi role / bật tắt active. Director có thể xem nhưng backend sẽ chặn sửa.
      </Text>
    </Card>
  );
};

export default AdminUsers;
