import { apiGet, apiPost } from './api'

export interface DeliveryProject { id: string; client_name: string; signed_at: string; status: string; solution_ref: string }
export interface GanttNode { node_id: string; task_name: string; planned_start: string; planned_end: string; actual_start?: string; actual_end?: string; status: string; order_index: number }
export interface ProjectDocument { doc_id: string; stage: string; filename: string; version_num: number }
export interface Issue { issue_id: string; title: string; priority: string; assignee: string; status: string; source: string }
export interface IssueBoard { todo: Issue[]; in_progress: Issue[]; resolved: Issue[] }

export async function createProject(body: {client_name: string; signed_at?: string; service_list?: any[]; solution_ref?: string}) { return apiPost<DeliveryProject>('/delivery/projects', body) }
export async function getProjects() { return apiGet<{projects: DeliveryProject[]}>('/delivery/projects') }
export async function getProject(id: string) { return apiGet<DeliveryProject>(`/delivery/projects/${id}`) }
export async function setupTeam(projectId: string, body: {project_lead_id?: string; teacher_id?: string}) { return apiPost(`/delivery/projects/${projectId}/team`, body) }
export async function getTeam(projectId: string) { return apiGet(`/delivery/projects/${projectId}/team`) }
export async function autoGenerateGantt(projectId: string) { return apiPost<{nodes: GanttNode[]}>(`/delivery/projects/${projectId}/gantt/auto`) }
export async function getGanttNodes(projectId: string) { return apiGet<{nodes: GanttNode[]}>(`/delivery/projects/${projectId}/gantt`) }
export async function updateGanttNode(projectId: string, nodeId: string, body: any) { return apiPost(`/delivery/projects/${projectId}/gantt/nodes/${nodeId}`, body) }
export async function confirmNode(projectId: string, nodeId: string) { return apiPost(`/delivery/projects/${projectId}/gantt/nodes/${nodeId}/confirm`) }
export async function getProgress(projectId: string) { return apiGet(`/delivery/projects/${projectId}/progress`) }
export async function getDocuments(projectId: string) { return apiGet<{documents: ProjectDocument[]}>(`/delivery/projects/${projectId}/documents`) }
export async function uploadDocument(projectId: string, body: {filename: string; file_url: string; stage?: string}) { return apiPost(`/delivery/projects/${projectId}/documents/upload`, body) }
export async function deleteDocument(projectId: string, docId: string) { return apiPost(`/delivery/projects/${projectId}/documents/${docId}`) } // using POST for soft-delete
export async function restoreDocument(projectId: string, docId: string) { return apiPost(`/delivery/projects/${projectId}/documents/${docId}/restore`) }
export async function getRecycleBin() { return apiGet<{items: any[]}>('/delivery/recycle-bin') }
export async function getIssues(projectId: string) { return apiGet<IssueBoard>(`/delivery/projects/${projectId}/issues`) }
export async function createIssue(projectId: string, body: {title: string; description?: string; priority?: string}) { return apiPost(`/delivery/projects/${projectId}/issues`, body) }
export async function updateIssueStatus(projectId: string, issueId: string, body: {status: string}) { return apiPost(`/delivery/projects/${projectId}/issues/${issueId}/status`, body) }
export async function getIssueRecommendations(projectId: string) { return apiGet(`/delivery/projects/${projectId}/issues/recommendations`) }
export async function recordClientMeeting(projectId: string, body: {recording_id: string}) { return apiPost(`/delivery/projects/${projectId}/meetings/record`, body) }
export async function getProjectMeetings(projectId: string) { return apiGet(`/delivery/projects/${projectId}/meetings`) }
export async function deliveryAssistantChat(body: {project_id: string; message: string}) { return apiPost('/delivery/assistant/chat', body) }
export async function archiveProject(projectId: string) { return apiPost(`/delivery/projects/${projectId}/archive`) }
export async function getOverdueAlert(projectId: string) { return apiPost(`/delivery/projects/${projectId}/overdue-alert`) }
