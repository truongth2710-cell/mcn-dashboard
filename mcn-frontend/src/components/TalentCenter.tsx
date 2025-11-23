import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useAuth0 } from "@auth0/auth0-react";
import { createApi } from "../api";
import type { Talent } from "../types";

const { Title, Text } = Typography;

const TalentCenter: React.FC = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const getApi = async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
    });
    return createApi(token);
  };

  const loadTalents = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const api = await getApi();
      const data = await api.listTalents();
      setTalents(data);
    } catch (e) {
      console.error(e);
      message.error("Không tải được danh sách talent.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTalents();
  }, [isAuthenticated]);

  const handleCreateTalent = async () => {
    try {
      const values = await form.validateFields();
      const api = await getApi();
      await api.createTalent({
        name: values.name,
        contact: values.contact,
        revSharePercent: values.revSharePercent,
        status: "active",
      });
      message.success("Đã tạo talent.");
      setCreateModalOpen(false);
      form.resetFields();
      loadTalents();
    } catch (e) {
      if ((e as any).errorFields) return;
      console.error(e);
      message.error("Không tạo được talent.");
    }
  };

  const columns: ColumnsType<Talent> = [
    {
      title: "Talent",
      dataIndex: "name",
      key: "name",
      render: (text: string, record) => (
        <>
          <Text strong>{text}</Text>
          {record.contact && (
            <div style={{ fontSize: 12 }}>
              <Text type="secondary">{record.contact}</Text>
            </div>
          )}
        </>
      ),
    },
    {
      title: "Rev share",
      dataIndex: "revSharePercent",
      key: "revSharePercent",
      width: 110,
      render: (v: number) => `${v}%`,
    },
    {
      title: "Channels",
      dataIndex: "channelsCount",
      key: "channelsCount",
      width: 110,
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
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: string) => (
        <Tag color={s === "active" ? "green" : "red"}>{s}</Tag>
      ),
    },
  ];

  return (
    <>
      <Card
        bordered={false}
        title={<Title level={4} style={{ margin: 0 }}>Talent / Network</Title>}
        extra={
          <Button type="primary" onClick={() => setCreateModalOpen(true)}>
            Thêm talent
          </Button>
        }
      >
        <Table<Talent>
          rowKey="id"
          loading={loading}
          dataSource={talents}
          columns={columns}
        />
      </Card>

      <Modal
        title="Thêm talent mới"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateTalent}
        okText="Tạo"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Tên talent"
            name="name"
            rules={[{ required: true, message: "Nhập tên talent" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Liên hệ" name="contact">
            <Input placeholder="Email / Telegram / SĐT" />
          </Form.Item>
          <Form.Item
            label="Rev share (%)"
            name="revSharePercent"
            rules={[{ required: true, message: "Nhập %" }]}
            initialValue={50}
          >
            <InputNumber min={0} max={100} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TalentCenter;
