import { apiGet, apiPost } from './api'

export interface DiagnosisResult { diagnosis_id: string; report: any; teacher_reviewed: boolean }
export interface CompanyIntel { intel_id: string; company_name: string; report: any; status: string }
export interface MeetingStrategy { strategy_id: string; strategy_doc: any; outline: any[] }
export interface MeetingAnalysis { meeting_id: string; achievement_rate: number; highlights: string; improvements: string; review_sop: string }
export interface RoleplayScore { session_id: string; score_a: number; score_b: number; total_score: number; passed: boolean; feedback: string }

export async function checkTransition() { return apiGet<{signals: any[]}>('/acquire/transition/check') }
export async function startDiagnosis(body: {resume_text: string}) { return apiPost<DiagnosisResult>('/acquire/diagnosis/start', body) }
export async function answerDiagnosis(body: {diagnosis_id: string; answers: any}) { return apiPost('/acquire/diagnosis/answer', body) }
export async function getDiagnoses() { return apiGet<{diagnoses: any[]}>('/acquire/diagnoses') }
export async function collectIntel(body: {company_name: string; context?: string}) { return apiPost<CompanyIntel>('/acquire/intel/collect', body) }
export async function getIntels() { return apiGet<{intels: CompanyIntel[]}>('/acquire/intels') }
export async function generateStrategy(body: {intel_id: string; diagnosis_id: string}) { return apiPost<MeetingStrategy>('/acquire/strategy/generate', body) }
export async function startMeeting(body: {strategy_id: string; recording_id?: string}) { return apiPost('/acquire/meeting/start', body) }
export async function analyzeMeeting(meetingId: string) { return apiPost<MeetingAnalysis>(`/acquire/meeting/${meetingId}/analyze`) }
export async function getMeetings() { return apiGet<{meetings: any[]}>('/acquire/meetings') }
export async function getNegotiations(meetingId: string) { return apiGet<{rounds: any[]}>(`/acquire/negotiations/${meetingId}`) }
export async function nextNegotiationRound(body: {meeting_id: string}) { return apiPost('/acquire/negotiations/next-round', body) }
export async function startRoleplay(body: {scenario_type: string}) { return apiPost<{session_id: string; client_text: string}>('/acquire/roleplay/start', body) }
export async function roleplayTurn(body: {session_id: string; user_response: string}) { return apiPost('/acquire/roleplay/turn', body) }
export async function scoreRoleplay(sessionId: string) { return apiPost<RoleplayScore>(`/acquire/roleplay/${sessionId}/score`) }
export async function getRoleplays() { return apiGet<{sessions: any[]}>('/acquire/roleplays') }
export async function generateProposal(body: {meeting_id: string}) { return apiPost('/acquire/proposal/generate', body) }
export async function uploadContract(body: {meeting_id: string; contract_url: string; service_list: any[]}) { return apiPost('/acquire/contract/upload', body) }
export async function getCompliance() { return apiGet<{reminder_shown: boolean}>('/acquire/compliance') }
export async function acceptCompliance() { return apiPost('/acquire/compliance/accept') }
