/**
 * MorningPlanContext — 朝有规划共享状态（PC 端专用）。
 * 使用 React Context + useReducer 实现，持久化到 localStorage key 'morning_plans'。
 * 与移动端 @rigeng/shared/context/MorningPlanContext 独立实现。
 */
import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type { Quadrant } from '@rigeng/shared/api/plans';

// ── Types ──────────────────────────────────────────────
export interface PlanItem {
  id: number;
  text: string;
  quadrant: Quadrant;
  completed: boolean;
  createdAt: string;
}

interface MorningPlanState {
  plans: PlanItem[];
}

type MorningPlanAction =
  | { type: 'ADD_PLAN'; text: string }
  | { type: 'DELETE_PLAN'; id: number }
  | { type: 'UPDATE_QUADRANT'; id: number; quadrant: Quadrant }
  | { type: 'TOGGLE_COMPLETE'; id: number }
  | { type: 'CONFIRM_ALL' }
  | { type: 'CLEAR_ALL' }
  | { type: 'RESET' }
  | { type: 'LOAD'; plans: PlanItem[] };

// ── Helpers ────────────────────────────────────────────
const STORAGE_KEY = 'morning_plans';

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
        id: Date.now(),
        text: action.text,
        quadrant: 'urgent_important' as Quadrant,
        completed: false,
        createdAt: new Date().toISOString(),
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
    case 'TOGGLE_COMPLETE': {
      const plans = state.plans.map((p) =>
        p.id === action.id ? { ...p, completed: !p.completed } : p,
      );
      saveToStorage(plans);
      return { plans };
    }
    case 'CONFIRM_ALL': {
      const plans = state.plans.map((p) => ({ ...p, completed: true }));
      saveToStorage(plans);
      return { plans };
    }
    case 'CLEAR_ALL': {
      saveToStorage([]);
      return { plans: [] };
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
interface MorningPlanContextValue {
  plans: PlanItem[];
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  plansByQuadrant: Record<Quadrant, PlanItem[]>;
  addPlan: (text: string) => void;
  deletePlan: (id: number) => void;
  updateQuadrant: (id: number, quadrant: Quadrant) => void;
  toggleComplete: (id: number) => void;
  confirmAll: () => void;
  clearAll: () => void;
  reset: () => void;
}

const MorningPlanCtx = createContext<MorningPlanContextValue | null>(null);

export function MorningPlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { plans: [] });

  useEffect(() => {
    const saved = loadFromStorage();
    if (saved.length > 0) {
      dispatch({ type: 'LOAD', plans: saved });
    }
  }, []);

  const totalTasks = state.plans.length;
  const completedTasks = state.plans.filter((p) => p.completed).length;
  const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const plansByQuadrant = state.plans.reduce(
    (acc, p) => {
      const key = p.quadrant || 'urgent_important';
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    },
    {
      urgent_important: [],
      not_urgent_important: [],
      urgent_not_important: [],
      not_urgent_not_important: [],
    } as Record<Quadrant, PlanItem[]>,
  );

  const addPlan = useCallback((text: string) => dispatch({ type: 'ADD_PLAN', text }), []);
  const deletePlan = useCallback((id: number) => dispatch({ type: 'DELETE_PLAN', id }), []);
  const updateQuadrant = useCallback(
    (id: number, quadrant: Quadrant) => dispatch({ type: 'UPDATE_QUADRANT', id, quadrant }),
    [],
  );
  const toggleComplete = useCallback((id: number) => dispatch({ type: 'TOGGLE_COMPLETE', id }), []);
  const confirmAll = useCallback(() => dispatch({ type: 'CONFIRM_ALL' }), []);
  const clearAll = useCallback(() => dispatch({ type: 'CLEAR_ALL' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return (
    <MorningPlanCtx.Provider
      value={{
        plans: state.plans,
        totalTasks,
        completedTasks,
        completionRate,
        plansByQuadrant,
        addPlan,
        deletePlan,
        updateQuadrant,
        toggleComplete,
        confirmAll,
        clearAll,
        reset,
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
