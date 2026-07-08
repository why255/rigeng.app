/**
 * MorningPlanContext — 朝有规划共享状态（移动端 + PC 端通用）。
 * 使用 React Context + useReducer 实现，持久化到 localStorage。
 * 对齐 m1-mobile.md 中定义的 MorningPlanState 接口。
 */
import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type { Quadrant } from '@/api/plans';

// ── Types ──────────────────────────────────────────────

export interface PlanItem {
  id: string;
  text: string;
  quadrant: Quadrant;
  completed: boolean;
  createdAt: number;
}

export interface MorningPlanStats {
  total: number;
  completed: number;
  rate: number;
  pending: number;
}

interface MorningPlanState {
  plans: PlanItem[];
}

type MorningPlanAction =
  | { type: 'ADD_PLAN'; text: string; quadrant?: Quadrant }
  | { type: 'DELETE_PLAN'; id: string }
  | { type: 'UPDATE_QUADRANT'; id: string; quadrant: Quadrant }
  | { type: 'COMPLETE_PLAN'; id: string }
  | { type: 'CONFIRM_ALL' }
  | { type: 'RESET' }
  | { type: 'LOAD'; plans: PlanItem[] };

// ── Helpers ────────────────────────────────────────────

const STORAGE_KEY = 'rg_morning_plans';

function loadFromStorage(): PlanItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function saveToStorage(plans: PlanItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch { /* ignore */ }
}

function reducer(state: MorningPlanState, action: MorningPlanAction): MorningPlanState {
  switch (action.type) {
    case 'ADD_PLAN': {
      const newPlan: PlanItem = {
        id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text: action.text,
        quadrant: action.quadrant || ('urgent_important' as Quadrant),
        completed: false,
        createdAt: Date.now(),
      };
      const plans = [...state.plans, newPlan];
      saveToStorage(plans);
      return { plans };
    }
    case 'DELETE_PLAN': {
      const plans = state.plans.filter((p) => p.id !== action.id);
      saveToStorage(plans);
      return { plans };
    }
    case 'UPDATE_QUADRANT': {
      const plans = state.plans.map((p) =>
        p.id === action.id ? { ...p, quadrant: action.quadrant } : p,
      );
      saveToStorage(plans);
      return { plans };
    }
    case 'COMPLETE_PLAN': {
      const plans = state.plans.map((p) =>
        p.id === action.id ? { ...p, completed: true } : p,
      );
      saveToStorage(plans);
      return { plans };
    }
    case 'CONFIRM_ALL': {
      // 确认所有计划（不标记为completed，仅持久化）
      // 在新流程中，CONFIRM_ALL 保持 plans 不变，只做持久化确认
      // 计划完成是在 P1 逐个点击确认的
      saveToStorage(state.plans);
      return state;
    }
    case 'RESET': {
      saveToStorage([]);
      return { plans: [] };
    }
    case 'LOAD': {
      return { plans: action.plans };
    }
    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────

export interface MorningPlanContextValue {
  plans: PlanItem[];
  // ── 新版 API（移动端 m1-mobile.md） ──
  addPlan: (text: string, quadrant?: Quadrant) => void;
  deletePlan: (id: string) => void;
  updateQuadrant: (id: string, quadrant: Quadrant) => void;
  completePlan: (id: string) => void;
  confirmAll: () => void;
  reset: () => void;
  getStats: () => MorningPlanStats;
  getPlansByQuadrant: () => Record<Quadrant, PlanItem[]>;
  // ── 旧版 API（PC 端向后兼容） ──
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  toggleComplete: (id: string) => void;
  clearAll: () => void;
}

const MorningPlanCtx = createContext<MorningPlanContextValue | null>(null);

export function MorningPlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { plans: [] });

  // 初始化时从 localStorage 加载
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved.length > 0) {
      dispatch({ type: 'LOAD', plans: saved });
    }
  }, []);

  const addPlan = useCallback(
    (text: string, quadrant?: Quadrant) => dispatch({ type: 'ADD_PLAN', text, quadrant }),
    [],
  );
  const deletePlan = useCallback((id: string) => dispatch({ type: 'DELETE_PLAN', id }), []);
  const updateQuadrant = useCallback(
    (id: string, quadrant: Quadrant) => dispatch({ type: 'UPDATE_QUADRANT', id, quadrant }),
    [],
  );
  const completePlan = useCallback((id: string) => dispatch({ type: 'COMPLETE_PLAN', id }), []);
  const confirmAll = useCallback(() => dispatch({ type: 'CONFIRM_ALL' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const getStats = useCallback((): MorningPlanStats => {
    const total = state.plans.length;
    const completed = state.plans.filter((p) => p.completed).length;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
    const pending = total - completed;
    return { total, completed, rate, pending };
  }, [state.plans]);

  const getPlansByQuadrant = useCallback((): Record<Quadrant, PlanItem[]> => {
    const result: Record<Quadrant, PlanItem[]> = {
      urgent_important: [],
      not_urgent_important: [],
      urgent_not_important: [],
      not_urgent_not_important: [],
    };
    for (const p of state.plans) {
      const key = p.quadrant || 'urgent_important';
      if (result[key]) {
        result[key].push(p);
      }
    }
    return result;
  }, [state.plans]);

  return (
    <MorningPlanCtx.Provider
      value={{
        plans: state.plans,
        addPlan,
        deletePlan,
        updateQuadrant,
        completePlan,
        confirmAll,
        reset,
        getStats,
        getPlansByQuadrant,
        // 旧版 API 向后兼容
        get totalTasks() { return state.plans.length; },
        get completedTasks() { return state.plans.filter((p) => p.completed).length; },
        get completionRate() {
          const t = state.plans.length;
          const c = state.plans.filter((p) => p.completed).length;
          return t === 0 ? 0 : Math.round((c / t) * 100);
        },
        toggleComplete: (id: string) => dispatch({ type: 'COMPLETE_PLAN', id }),
        clearAll: () => dispatch({ type: 'RESET' }),
      }}
    >
      {children}
    </MorningPlanCtx.Provider>
  );
}

export function useMorningPlan(): MorningPlanContextValue {
  const ctx = useContext(MorningPlanCtx);
  if (!ctx) {
    throw new Error('useMorningPlan must be used within MorningPlanProvider');
  }
  return ctx;
}
