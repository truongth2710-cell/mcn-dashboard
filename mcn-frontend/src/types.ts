export type StaffRole =
  | "admin"
  | "director"
  | "team_lead"
  | "channel_manager"
  | "editor"
  | "viewer"
  | string;

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  avatarUrl?: string | null;
  active: boolean;
  createdAt?: string;
  openTasks?: number;
  published28d?: number;
  teams?: { id: number; name: string }[];
}

export interface Team {
  id: number;
  name: string;
  description?: string | null;
  createdAt?: string;
  membersCount?: number;
  channelsCount?: number;
  totalViews28d?: number;
  totalRevenue28d?: number;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  channel_id?: string | null;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  tags?: string[] | null;
  created_at?: string;
}

export type TaskStatus =
  | "idea"
  | "script"
  | "shooting"
  | "editing"
  | "review"
  | "scheduled"
  | "published"
  | "cancelled"
  | string;

export interface TaskChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Task {
  id: number;
  title: string;
  channel_id?: string | null;
  project_id?: number | null;
  youtube_video_id?: string | null;
  status: TaskStatus;
  pipeline_stage: string;
  assignee_id?: number | null;
  due_date?: string | null;
  checklist: TaskChecklistItem[];
  created_at?: string;
  updated_at?: string;
}

export interface TaskBoardResponse {
  columns: Record<string, Task[]>;
}

export interface Talent {
  id: number;
  name: string;
  contact?: string | null;
  revSharePercent: number;
  status: string;
  createdAt?: string;
  channelsCount?: number;
  totalViews28d?: number;
  totalRevenue28d?: number;
}

export interface CompanySummary {
  totalViews: number;
  totalRevenue: number;
  totalChannels: number;
}

export interface CompanyDailyPoint {
  date: string;
  views: number;
  revenue: number;
}

export interface CompanyTopChannel {
  channelId: string;
  revenue: number;
}

export interface CompanyReport {
  range: { startDate: string; endDate: string };
  summary: CompanySummary;
  daily: CompanyDailyPoint[];
  topChannels: CompanyTopChannel[];
}

export interface TeamReportItem {
  teamId: number;
  name: string;
  channelsCount: number;
  totalViews: number;
  totalRevenue: number;
}

export interface TeamReport {
  range: { startDate: string; endDate: string };
  teams: TeamReportItem[];
}

export interface TalentReportItem {
  talentId: number;
  name: string;
  revSharePercent: number;
  channelsCount: number;
  totalViews: number;
  totalRevenue: number;
}

export interface TalentReport {
  range: { startDate: string; endDate: string };
  talents: TalentReportItem[];
}
