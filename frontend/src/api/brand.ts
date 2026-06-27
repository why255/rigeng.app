/**
 * 品牌打造中心 (M8) API 封装
 * 对应后端 brand 相关接口
 */
import { apiGet, apiPost } from './api'

export interface BrandProfile { authorized_sources: string[]; strategy_prefs: any; status: string }
export interface MomentContent { content_id: string; time_slot: string; text: string; image_url: string; status: string }
export interface ArticleContent { content_id: string; title: string; body: string; cover_url: string; status: string }
export interface BrandAnalytics { views: number; likes: number; shares: number; comments: number; consultation_triggered: number; trends: any[] }
export interface CourageValue { total_score: number; level: string; milestones: any[]; trend: number[] }

export async function startOnboarding() { return apiPost<{profile_id: string; disclaimer_accepted: boolean}>('/brand/onboarding') }
export async function authorizeSources(body: {sources: string[]}) { return apiPost('/brand/sources/authorize', body) }
export async function generateMoment(body: {time_slot?: string; topic?: string}) { return apiPost<MomentContent>('/brand/moments/generate', body) }
export async function confirmMoment(body: {content_id: string; action: 'confirm' | 'modify'; modified_text?: string}) { return apiPost('/brand/moments/confirm', body) }
export async function generateArticle(body: {topic?: string; style?: string}) { return apiPost<ArticleContent>('/brand/articles/generate', body) }
export async function confirmArticle(body: {content_id: string; action: 'confirm' | 'modify'; modifications?: any}) { return apiPost('/brand/articles/confirm', body) }
export async function getBrandAnalytics() { return apiGet<BrandAnalytics>('/brand/analytics') }
export async function markLead(body: {content_id: string; lead_type: string; contact_info?: string}) { return apiPost('/brand/leads/mark', body) }
export async function getCourageValue() { return apiGet<CourageValue>('/brand/courage') }
export async function pauseGeneration() { return apiPost('/brand/pause') }
export async function resumeGeneration() { return apiPost('/brand/resume') }
