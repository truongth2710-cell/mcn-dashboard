import React, { useState } from "react";
import { Button, Card, Input, Space, Typography, message, Tooltip } from "antd";
import { SyncOutlined, YoutubeOutlined, LinkOutlined } from "@ant-design/icons";
import { useAuth0 } from "@auth0/auth0-react";

const { Text } = Typography;

const API_BASE = import.meta.env.VITE_API_BASE as string;
const AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE as string;

/**
 * Panel nhỏ chứa hai nút:
 *  - Kết nối YouTube (OAuth)
 *  - Sync 30 ngày gần nhất cho 1 channel
 *
 * Bạn có thể đặt component này ở Reports, Talent hoặc Admin tùy ý.
 */
const YouTubeSyncPanel: React.FC = () => {
  const { getAccessTokenSilently } = useAuth0();
  const [channelId, setChannelId] = useState<string>("");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);

  const getToken = async () => {
    return getAccessTokenSilently({
      authorizationParams: {
        audience: AUDIENCE,
      },
    });
  };

  const handleConnectYouTube = async () => {
    try {
      setLoadingAuth(true);
      const token = await getToken();

      const res = await fetch(`${API_BASE}/api/youtube/auth-url`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Cannot get auth url");
      }

      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        message.success("Mở cửa sổ kết nối YouTube, hãy đăng nhập và cấp quyền.");
      } else {
        message.error("Không nhận được URL kết nối YouTube.");
      }
    } catch (err: any) {
      console.error("connect youtube error", err);
      message.error("Lỗi khi lấy URL kết nối YouTube.");
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleSyncLast30Days = async () => {
    if (!channelId.trim()) {
      message.warning("Hãy nhập channelId (ví dụ UCxxxxxx).");
      return;
    }

    try {
      setLoadingSync(true);
      const token = await getToken();

      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 29);

      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);

      const res = await fetch(`${API_BASE}/api/youtube/sync-channel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ channelId: channelId.trim(), startDate, endDate }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Sync failed");
      }

      const data = await res.json();
      message.success(`Đã sync ${data.rows ?? 0} dòng dữ liệu cho kênh.`);
    } catch (err: any) {
      console.error("sync youtube error", err);
      message.error("Lỗi khi sync dữ liệu YouTube.");
    } finally {
      setLoadingSync(false);
    }
  };

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
          <Space>
            <YoutubeOutlined />
            <Text strong>YouTube Integration</Text>
          </Space>
          <Tooltip title="Mở cửa sổ Google để gắn tài khoản YouTube/Analytics cho dashboard.">
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={handleConnectYouTube}
              loading={loadingAuth}
            >
              Kết nối YouTube
            </Button>
          </Tooltip>
        </Space>

        <Space direction="vertical" style={{ width: "100%" }}>
          <Text type="secondary">
            Sync dữ liệu 30 ngày gần nhất cho 1 channel (theo channelId đúng như trong DB).
          </Text>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder="Channel ID (ví dụ UCxxxxxxxx)"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            />
            <Button
              type="default"
              icon={<SyncOutlined />}
              onClick={handleSyncLast30Days}
              loading={loadingSync}
            >
              Sync 30 ngày gần nhất
            </Button>
          </Space.Compact>
        </Space>
      </Space>
    </Card>
  );
};

export default YouTubeSyncPanel;
