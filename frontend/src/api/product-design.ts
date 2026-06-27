import { apiPost } from './api'

export interface DiagnosisV1 { diagnosis_id: string; report: any; status: string }
export interface DiagnosisV2 { diagnosis_id: string; report: any; enhanced_by: string }
export interface SolutionVersion { solution_id: string; version_label: 'A' | 'B'; content: any; source_calls: any }
export interface PreResearchProduct { product_id: string; template_type: string; name: string; content: any }

export async function enterProductDesign(body: {entry_type: 'full_abs' | 'pre_research'; contract_ref?: string}) { return apiPost('/product-design/enter', body) }
export async function decomposeRequirements(body: {project_id: string; contract_text?: string; service_list?: any[]}) { return apiPost('/product-design/demand/decompose', body) }
export async function generateDiagnosisV1(body: {project_id: string; questionnaire_answers: any}) { return apiPost<DiagnosisV1>('/product-design/diagnosis/v1', body) }
export async function enhanceDiagnosisV2(body: {diagnosis_id: string; enhancements: any}) { return apiPost<DiagnosisV2>('/product-design/diagnosis/v2', body) }
export async function setTargets(body: {project_id: string; targets: {metric: string; current: number; target: number; unit: string}[]}) { return apiPost('/product-design/targets/set', body) }
export async function generateSolutions(body: {project_id: string}) { return apiPost<{solutions: SolutionVersion[]}>('/product-design/solutions/generate', body) }
export async function selectSolution(body: {solution_id: string}) { return apiPost('/product-design/solutions/select', body) }
export async function exportSolution(body: {solution_id: string; format: 'pdf' | 'word'}) { return apiPost<{download_url: string}>('/product-design/solutions/export', body) }
export async function annotateUpgrade(body: {solution_id: string}) { return apiPost('/product-design/solutions/annotate', body) }
export async function createPreResearch(body: {template_type: string; name: string}) { return apiPost<PreResearchProduct>('/product-design/pre-research/create', body) }
export async function reuseSolution(body: {source_solution_id: string; target_project_id: string}) { return apiPost('/product-design/solutions/reuse', body) }
export async function bookCoaching(body: {project_id: string; teacher_id?: string; scheduled_at: string}) { return apiPost('/product-design/coaching/book', body) }
