/**
 * 高维求职 (M7) API 封装
 * 对应后端求职相关接口
 */
import { apiGet, apiPost } from './api'

export interface CareerProgress { current_step: number; step_name: string; completed_steps: number; total_steps: number }
export interface STARResult { id: string; situation: string; task: string; action: string; result: string; quantified_value: string }
export interface SkillCrystal { id: string; what: string; how: string; notes: string; outcome: string; reusable_sop: string }
export interface JobApplication { id: string; channel: string; position: string; company: string; date: string; status: string; invite_received: boolean }
export interface InterviewPrep { id: string; strategy_doc: any; question_list: any[]; match_analysis: string }
export interface InterviewReview { id: string; highlights: string; improvements: string; review_sop: string }
export interface OfferComparison { id: string; offers: any[]; dimensions: string[] }

export async function uploadResume(body: {resume_text: string}) { return apiPost('/career/resume/upload', body) }
export async function getProgress() { return apiGet<CareerProgress>('/career/progress') }
export async function getStepData(stepId: string) { return apiGet<any>(`/career/step/${stepId}`) }
export async function extractSTAR(body: {experience_text: string}) { return apiPost<STARResult>('/career/star/extract', body) }
export async function getSkillCrystals() { return apiGet<{crystals: SkillCrystal[]}>('/career/skill-crystals') }
export async function archiveCrystal(crystalId: string) { return apiPost(`/career/skill-crystals/${crystalId}/archive`) }
export async function createStrategy(body: {resources: any; plan: any}) { return apiPost('/career/strategy', body) }
export async function trackApplication(body: {channel: string; position: string; company: string}) { return apiPost('/career/applications', body) }
export async function getApplications() { return apiGet<{applications: JobApplication[]; invite_rate: number}>('/career/applications') }
export async function prepareInterview(body: {position?: string; company_name?: string}) { return apiPost<InterviewPrep>('/career/interview/prepare', body) }
export async function linkRecordingToCareer(body: {recording_id: string}) { return apiPost('/career/interview/record', body) }
export async function analyzeInterview(interviewId: string) { return apiPost<InterviewReview>(`/career/interview/${interviewId}/analyze`) }
export async function compareOffers(body: {offers: any[]}) { return apiPost<OfferComparison>('/career/offers/compare', body) }
export async function acceptOffer(comparisonId: string) { return apiPost(`/career/offers/${comparisonId}/accept`) }
