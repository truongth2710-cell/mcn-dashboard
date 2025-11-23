import axios from "axios";
import type {
  StaffUser,
  Team,
  Project,
  Task,
  TaskBoardResponse,
  Talent,
  CompanyReport,
  TeamReport,
  TalentReport,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export function createApi(token: string) {
  const client = axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return {
    async getCurrentUser(): Promise<StaffUser> {
      const { data } = await client.get<{ user: StaffUser }>("/api/me");
      return data.user;
    },

    async listStaff(): Promise<StaffUser[]> {
      const { data } = await client.get<{ data: StaffUser[] }>("/api/staff");
      return data.data;
    },
    async updateStaff(
      id: number,
      payload: Partial<Pick<StaffUser, "name" | "role" | "active">>
    ): Promise<StaffUser> {
      const { data } = await client.patch<{ user: StaffUser }>(`/api/staff/${id}`, payload);
      return data.user;
    },

    async listTeams(): Promise<Team[]> {
      const { data } = await client.get<{ data: Team[] }>("/api/teams");
      return data.data;
    },
    async getTeam(id: number): Promise<{
      team: Team;
      members: StaffUser[];
      channels: string[];
      kpi28d: { totalViews28d: number; totalRevenue28d: number };
    }> {
      const { data } = await client.get(`/api/teams/${id}`);
      return data;
    },
    async createTeam(payload: { name: string; description?: string }): Promise<Team> {
      const { data } = await client.post<{ team: Team }>("/api/teams", payload);
      return data.team;
    },
    async addMemberToTeam(teamId: number, userId: number): Promise<void> {
      await client.post(`/api/teams/${teamId}/members`, { userId });
    },
    async removeMemberFromTeam(teamId: number, userId: number): Promise<void> {
      await client.delete(`/api/teams/${teamId}/members/${userId}`);
    },
    async addChannelToTeam(teamId: number, channelId: string): Promise<void> {
      await client.post(`/api/teams/${teamId}/channels`, { channelId });
    },
    async removeChannelFromTeam(teamId: number, channelId: string): Promise<void> {
      await client.delete(`/api/teams/${teamId}/channels/${channelId}`);
    },

    async listProjects(): Promise<Project[]> {
      const { data } = await client.get<{ data: Project[] }>("/api/projects");
      return data.data;
    },
    async createProject(payload: {
      name: string;
      description?: string;
      channelId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      tags?: string[];
    }): Promise<Project> {
      const body = {
        name: payload.name,
        description: payload.description,
        channelId: payload.channelId,
        status: payload.status,
        startDate: payload.startDate,
        endDate: payload.endDate,
        tags: payload.tags,
      };
      const { data } = await client.post<{ project: Project }>("/api/projects", body);
      return data.project;
    },

    async getTaskBoard(params?: { channelId?: string; projectId?: number }): Promise<TaskBoardResponse> {
      const { data } = await client.get<TaskBoardResponse>("/api/tasks/board", { params });
      return data;
    },
    async createTask(payload: {
      title: string;
      channelId?: string;
      projectId?: number;
      status?: string;
      pipelineStage?: string;
      assigneeId?: number;
      dueDate?: string;
      checklist?: any[];
    }): Promise<Task> {
      const { data } = await client.post<{ task: Task }>("/api/tasks", payload);
      return data.task;
    },
    async updateTask(id: number, payload: Partial<Task>): Promise<Task> {
      const { data } = await client.patch<{ task: Task }>(`/api/tasks/${id}`, payload);
      return data.task;
    },

    async listTalents(): Promise<Talent[]> {
      const { data } = await client.get<{ data: Talent[] }>("/api/talents");
      return data.data;
    },
    async createTalent(payload: {
      name: string;
      contact?: string;
      revSharePercent?: number;
      status?: string;
    }): Promise<Talent> {
      const { data } = await client.post<{ talent: Talent }>("/api/talents", payload);
      return data.talent;
    },

    async getCompanyReport(params?: { startDate?: string; endDate?: string }): Promise<CompanyReport> {
      const { data } = await client.get<CompanyReport>("/api/reports/company", { params });
      return data;
    },
    async getTeamReport(params?: { startDate?: string; endDate?: string }): Promise<TeamReport> {
      const { data } = await client.get<TeamReport>("/api/reports/teams", { params });
      return data;
    },
    async getTalentReport(params?: { startDate?: string; endDate?: string }): Promise<TalentReport> {
      const { data } = await client.get<TalentReport>("/api/reports/talents", { params });
      return data;
    },

    async getAuditLogs(params?: { entityType?: string; entityId?: number; limit?: number }) {
      const { data } = await client.get<{ data: any[] }>("/api/audit-logs", { params });
      return data.data;
    },
  };
}
