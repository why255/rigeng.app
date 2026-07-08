/**
 * usePlanData — 朝有规划中心状态 Hook。
 *
 * 统一管理今日计划数据、任务列表、统计信息。
 * 在线时调 API，离线时走 localStorage。
 * 网络恢复时自动同步。
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Plan, PlanTask, TodayOverview, Quadrant } from '@/api/plans';
import * as plansApi from '@/api/plans';
import { useOnlineStatus } from './useOnlineStatus';
import {
  savePlanLocally,
  getLocalPlan,
  clearLocalPlan,
  queueSyncAction,
  getSyncQueue,
  clearSyncQueue,
} from '@/api/offlineStore';

export interface UsePlanDataReturn {
  plan: Plan | null;
  tasks: PlanTask[];
  stats: TodayOverview | null;
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  refresh: () => Promise<void>;
  createPlan: (title: string, tasks: Array<{
    title: string;
    description?: string;
    quadrant?: string;
    source?: string;
    time_estimate?: string;
  }>) => Promise<Plan | null>;
  addTask: (task: {
    title: string;
    description?: string;
    quadrant?: string;
    source?: string;
    time_estimate?: string;
  }) => Promise<PlanTask | null>;
  updateTask: (taskId: string, updates: {
    title?: string;
    description?: string;
    quadrant?: string;
    status?: string;
    sort_order?: number;
    time_estimate?: string;
  }) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  moveTaskQuadrant: (taskId: string, newQuadrant: Quadrant) => Promise<void>;
  completePlan: () => Promise<void>;
  archivePlan: () => Promise<void>;
  promoteTasks: (taskIds: string[], source?: string) => Promise<void>;
}

export function usePlanData(): UsePlanDataReturn {
  const { isOnline, wasOffline, clearWasOffline } = useOnlineStatus();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [stats, setStats] = useState<TodayOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncing = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (isOnline) {
        const [planData, statsData] = await Promise.all([
          plansApi.fetchTodayPlan(),
          plansApi.fetchStats(),
        ]);
        setPlan(planData);
        setTasks(planData?.tasks ?? []);
        setStats(statsData);
        if (planData) {
          savePlanLocally(planData);
        }
      } else {
        // 离线：从 localStorage 读取
        const localPlan = getLocalPlan();
        setPlan(localPlan);
        setTasks(localPlan?.tasks ?? []);
        setStats(
          localPlan?.stats
            ? {
                task_count: localPlan.stats.total_tasks,
                completion_rate: localPlan.stats.completion_rate,
                pending_count: localPlan.stats.pending_tasks,
              }
            : { task_count: 0, completion_rate: 0, pending_count: 0 },
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载失败';
      setError(msg);
      // 尝试 fallback 到本地
      const localPlan = getLocalPlan();
      if (localPlan) {
        setPlan(localPlan);
        setTasks(localPlan.tasks ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  // 初次加载
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 网络恢复时同步
  useEffect(() => {
    if (wasOffline && isOnline && !syncing.current) {
      syncing.current = true;
      const queue = getSyncQueue();
      if (queue.length > 0) {
        plansApi
          .syncOffline(queue)
          .then((result) => {
            console.log('离线同步完成:', result);
            clearSyncQueue();
            clearLocalPlan();
          })
          .catch((e) => {
            console.error('离线同步失败:', e);
          })
          .finally(() => {
            syncing.current = false;
            clearWasOffline();
            refresh();
          });
      } else {
        syncing.current = false;
        clearWasOffline();
        refresh();
      }
    }
  }, [wasOffline, isOnline, clearWasOffline, refresh]);

  const createPlan = useCallback(
    async (title: string, taskList: Array<{
      title: string;
      description?: string;
      quadrant?: string;
      source?: string;
      time_estimate?: string;
    }>): Promise<Plan | null> => {
      try {
        if (isOnline) {
          const newPlan = await plansApi.createPlan(title, taskList);
          setPlan(newPlan);
          setTasks(newPlan.tasks);
          savePlanLocally(newPlan);
          await refresh();
          return newPlan;
        } else {
          // 离线：构建临时计划
          const tempPlan: Plan = {
            id: `local_${Date.now()}`,
            user_id: '',
            title,
            status: 'active',
            tasks: taskList.map((t, i) => ({
              id: `local_task_${Date.now()}_${i}`,
              plan_id: `local_${Date.now()}`,
              title: t.title,
              quadrant: (t.quadrant as Quadrant) || 'not_urgent_important',
              source: (t.source as PlanTask['source']) || 'user_input',
              status: 'pending',
              sort_order: i,
              time_estimate: t.time_estimate || null,
            })),
            stats: {
              total_tasks: taskList.length,
              completed_tasks: 0,
              completion_rate: 0,
              pending_tasks: taskList.length,
            },
          };
          setPlan(tempPlan);
          setTasks(tempPlan.tasks);
          savePlanLocally(tempPlan);
          queueSyncAction({
            action: 'create_plan',
            payload: { title, tasks: taskList },
            timestamp: Date.now(),
          });
          return tempPlan;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '创建失败');
        return null;
      }
    },
    [isOnline, refresh],
  );

  const updateTask = useCallback(
    async (taskId: string, updates: Record<string, unknown>) => {
      if (!plan) return;
      // 乐观更新
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
      );
      try {
        if (isOnline) {
          await plansApi.updateTask(plan.id, taskId, updates);
        } else {
          queueSyncAction({
            action: 'update_task',
            payload: { plan_id: plan.id, task_id: taskId, ...updates },
            timestamp: Date.now(),
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '更新失败');
        await refresh(); // 回滚
      }
    },
    [plan, isOnline, refresh],
  );

  const moveTaskQuadrant = useCallback(
    async (taskId: string, newQuadrant: Quadrant) => {
      if (!plan) return;
      // 乐观更新
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, quadrant: newQuadrant } : t,
        ),
      );
      try {
        if (isOnline) {
          await plansApi.moveTaskQuadrant(plan.id, taskId, newQuadrant);
        } else {
          queueSyncAction({
            action: 'update_task',
            payload: { plan_id: plan.id, task_id: taskId, quadrant: newQuadrant },
            timestamp: Date.now(),
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '移动失败');
        await refresh();
      }
    },
    [plan, isOnline, refresh],
  );

  const completePlan = useCallback(async () => {
    if (!plan) return;
    try {
      if (isOnline) {
        const updated = await plansApi.completePlan(plan.id);
        setPlan(updated);
        setTasks(updated.tasks);
        setStats(
          updated.stats
            ? {
                task_count: updated.stats.total_tasks,
                completion_rate: updated.stats.completion_rate,
                pending_count: updated.stats.pending_tasks,
              }
            : null,
        );
      } else {
        queueSyncAction({
          action: 'complete_plan',
          payload: { plan_id: plan.id },
          timestamp: Date.now(),
        });
        // 本地乐观更新
        setPlan((prev) => (prev ? { ...prev, status: 'completed' } : prev));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '归档失败');
    }
  }, [plan, isOnline]);

  const archivePlan = useCallback(async () => {
    if (!plan) return;
    try {
      if (isOnline) {
        await plansApi.archivePlan(plan.id);
        clearLocalPlan();
        setPlan(null);
        setTasks([]);
        setStats(null);
      } else {
        queueSyncAction({
          action: 'complete_plan',
          payload: { plan_id: plan.id },
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '归档失败');
    }
  }, [plan, isOnline]);

  const addTask = useCallback(
    async (task: {
      title: string;
      description?: string;
      quadrant?: string;
      source?: string;
      time_estimate?: string;
    }): Promise<PlanTask | null> => {
      if (!plan) return null;
      try {
        if (isOnline) {
          const newTask = await plansApi.addTask(plan.id, task);
          setTasks((prev) => [...prev, newTask]);
          await refresh();
          return newTask;
        } else {
          // 离线暂存
          const tempTask: PlanTask = {
            id: `local_task_${Date.now()}`,
            plan_id: plan.id,
            title: task.title,
            description: task.description || null,
            quadrant: (task.quadrant as Quadrant) || 'not_urgent_important',
            source: (task.source as PlanTask['source']) || 'user_input',
            status: 'pending',
            sort_order: tasks.length,
            time_estimate: task.time_estimate || null,
          };
          setTasks((prev) => [...prev, tempTask]);
          queueSyncAction({
            action: 'update_task',
            payload: { plan_id: plan.id, ...task },
            timestamp: Date.now(),
          });
          return tempTask;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '添加任务失败');
        return null;
      }
    },
    [plan, tasks, isOnline, refresh],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!plan) return;
      // 乐观删除
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      try {
        if (isOnline) {
          await plansApi.deleteTask(plan.id, taskId);
          await refresh();
        } else {
          queueSyncAction({
            action: 'update_task',
            payload: { plan_id: plan.id, task_id: taskId, deleted: true },
            timestamp: Date.now(),
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '删除失败');
        await refresh();
      }
    },
    [plan, isOnline, refresh],
  );

  const promoteTasks = useCallback(
    async (taskIds: string[], source: string = 'yesterday_unfinished') => {
      if (!plan || taskIds.length === 0) return;
      try {
        if (isOnline) {
          await plansApi.promoteTasks(plan.id, taskIds, source);
          await refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '提升任务失败');
      }
    },
    [plan, isOnline, refresh],
  );

  return {
    plan,
    tasks,
    stats,
    isLoading,
    error,
    isOffline: !isOnline,
    refresh,
    createPlan,
    addTask,
    updateTask,
    deleteTask,
    moveTaskQuadrant,
    completePlan,
    archivePlan,
    promoteTasks,
  };
}
