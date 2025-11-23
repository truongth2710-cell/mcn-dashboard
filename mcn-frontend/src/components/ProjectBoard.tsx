import React, { useEffect, useState } from "react";
import {
  Card,
  Select,
  Space,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Tag,
  message,
} from "antd";
import { useAuth0 } from "@auth0/auth0-react";
import { createApi } from "../api";
import type { Project, Task, TaskBoardResponse } from "../types";

const { Title, Text } = Typography;

const PIPELINE_STAGES = [
  "Idea",
  "Script",
  "Shooting",
  "Editing",
  "Review",
  "Scheduled",
  "Published",
];

const ProjectBoard: React.FC = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [projects, setProjects] = useState<Project[]>([]);
  const [board, setBoard] = useState<TaskBoardResponse["columns"]>({});
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);

  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [createProjectForm] = Form.useForm();
  const [createTaskForm] = Form.useForm();

  const getApi = async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
    });
    return createApi(token);
  };

  const loadProjects = async () => {
    if (!isAuthenticated) return;
    try {
      const api = await getApi();
      const data = await api.listProjects();
      setProjects(data);
      if (!selectedProjectId && data.length) {
        setSelectedProjectId(data[0].id);
      }
    } catch (e) {
      console.error(e);
      message.error("Không tải được danh sách project.");
    }
  };

  const loadBoard = async () => {
    if (!isAuthenticated || !selectedProjectId) return;
    setLoadingBoard(true);
    try {
      const api = await getApi();
      const data = await api.getTaskBoard({ projectId: selectedProjectId });
      setBoard(data.columns || {});
    } catch (e) {
      console.error(e);
      message.error("Không tải được task board.");
    } finally {
      setLoadingBoard(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedProjectId) {
      loadBoard();
    }
  }, [selectedProjectId]);

  const handleCreateProject = async () => {
    try {
      const values = await createProjectForm.validateFields();
      const api = await getApi();
      await api.createProject({
        name: values.name,
        description: values.description,
        channelId: values.channelId,
      });
      message.success("Đã tạo project mới.");
      setCreateProjectModalOpen(false);
      createProjectForm.resetFields();
      loadProjects();
    } catch (e) {
      if ((e as any).errorFields) return;
      console.error(e);
      message.error("Không tạo được project.");
    }
  };

  const handleCreateTask = async () => {
    if (!selectedProjectId) {
      message.warning("Chọn project trước khi tạo task.");
      return;
    }
    try {
      const values = await createTaskForm.validateFields();
      const api = await getApi();
      await api.createTask({
        title: values.title,
        channelId: values.channelId,
        projectId: selectedProjectId,
        pipelineStage: values.pipelineStage || "Idea",
        status: values.status || "idea",
        dueDate: values.dueDate
          ? values.dueDate.format("YYYY-MM-DD")
          : undefined,
      });
      message.success("Đã tạo task.");
      setCreateTaskModalOpen(false);
      createTaskForm.resetFields();
      loadBoard();
    } catch (e) {
      if ((e as any).errorFields) return;
      console.error(e);
      message.error("Không tạo được task.");
    }
  };

  const renderColumn = (stage: string, tasks: Task[]) => (
    <Card
      key={stage}
      size="small"
      title={
        <Space>
          <Text strong>{stage}</Text>
          <Tag>{tasks.length}</Tag>
        </Space>
      }
      style={{ minWidth: 260, maxHeight: "70vh", overflowY: "auto" }}
      loading={loadingBoard}
    >
      {tasks.map((t) => (
        <Card
          key={t.id}
          size="small"
          style={{ marginBottom: 8 }}
          bodyStyle={{ padding: 8 }}
        >
          <Text strong>{t.title}</Text>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {t.due_date && (
              <div>
                Due:{" "}
                {new Date(t.due_date).toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </div>
            )}
            {t.channel_id && <div>Channel: {t.channel_id}</div>}
          </div>
        </Card>
      ))}
    </Card>
  );

  const columnsOrder = PIPELINE_STAGES;

  return (
    <>
      <Space
        style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Production / Projects
          </Title>
          <Text type="secondary">
            Quản lý workflow sản xuất video theo pipeline (Idea → Published)
          </Text>
        </div>
        <Space>
          <Select
            style={{ minWidth: 220 }}
            placeholder="Chọn project"
            value={selectedProjectId ?? undefined}
            onChange={(val) => setSelectedProjectId(val)}
            options={projects.map((p) => ({
              label: p.name,
              value: p.id,
            }))}
          />
          <Button onClick={() => setCreateProjectModalOpen(true)}>
            Tạo project
          </Button>
          <Button type="primary" onClick={() => setCreateTaskModalOpen(true)}>
            Tạo task
          </Button>
        </Space>
      </Space>

      <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {columnsOrder.map((stage) =>
          renderColumn(stage, board[stage] || [])
        )}
      </div>

      <Modal
        title="Tạo project mới"
        open={createProjectModalOpen}
        onCancel={() => setCreateProjectModalOpen(false)}
        onOk={handleCreateProject}
        okText="Tạo"
      >
        <Form form={createProjectForm} layout="vertical">
          <Form.Item
            label="Tên project"
            name="name"
            rules={[{ required: true, message: "Nhập tên project" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Channel ID" name="channelId">
            <Input placeholder="Tùy chọn" />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Tạo task mới"
        open={createTaskModalOpen}
        onCancel={() => setCreateTaskModalOpen(false)}
        onOk={handleCreateTask}
        okText="Tạo"
      >
        <Form form={createTaskForm} layout="vertical">
          <Form.Item
            label="Tiêu đề"
            name="title"
            rules={[{ required: true, message: "Nhập tiêu đề task" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Channel ID" name="channelId">
            <Input placeholder="Tùy chọn" />
          </Form.Item>
          <Form.Item label="Pipeline stage" name="pipelineStage" initialValue="Idea">
            <Select
              options={PIPELINE_STAGES.map((st) => ({
                label: st,
                value: st,
              }))}
            />
          </Form.Item>
          <Form.Item label="Status" name="status" initialValue="idea">
            <Select
              options={[
                { label: "Idea", value: "idea" },
                { label: "In progress", value: "in_progress" },
                { label: "Published", value: "published" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Deadline" name="dueDate">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ProjectBoard;
