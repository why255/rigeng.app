/**
 * offlineStore — 离线数据存储。
 *
 * 使用 localStorage 缓存计划和待同步操作队列。
 * 网络恢复后自动同步。
 */

import type { Plan, SyncItem } from './plans';

const KEYS = {
  plan: 'rg_offline_plan',
  syncQueue: 'rg_sync_queue',
};

export function savePlanLocally(plan: Plan): void {
  try {
    localStorage.setItem(KEYS.plan, JSON.stringify(plan));
  } catch {
    // localStorage 满或不可用
  }
}

export function getLocalPlan(): Plan | null {
  try {
    const raw = localStorage.getItem(KEYS.plan);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocalPlan(): void {
  try {
    localStorage.removeItem(KEYS.plan);
  } catch {
    // ignore
  }
}

export function queueSyncAction(action: SyncItem): void {
  try {
    const raw = localStorage.getItem(KEYS.syncQueue);
    const queue: SyncItem[] = raw ? JSON.parse(raw) : [];
    queue.push(action);
    localStorage.setItem(KEYS.syncQueue, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function getSyncQueue(): SyncItem[] {
  try {
    const raw = localStorage.getItem(KEYS.syncQueue);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearSyncQueue(): void {
  try {
    localStorage.removeItem(KEYS.syncQueue);
  } catch {
    // ignore
  }
}

export function hasPendingSync(): boolean {
  return getSyncQueue().length > 0;
}
