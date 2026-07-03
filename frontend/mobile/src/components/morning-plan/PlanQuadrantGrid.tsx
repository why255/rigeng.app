/**
 * PlanQuadrantGrid — 桥接组件。
 * 将 MorningPlanContext 的 PlanItem[] 映射为 EisenhowerMatrix 需要的 PlanTask[]。
 */
import { useMorningPlan, type PlanItem } from '@rigeng/shared/context/MorningPlanContext';
import { EisenhowerMatrix } from '@rigeng/shared/components/plan/EisenhowerMatrix';
import type { PlanTask, Quadrant } from '@rigeng/shared/api/plans';

/** 将 PlanItem (context) 转为 PlanTask (EisenhowerMatrix 接口) */
function planItemToTask(item: PlanItem, index: number): PlanTask {
  return {
    id: item.id,
    plan_id: '',
    title: item.text,
    description: null,
    quadrant: item.quadrant,
    source: 'user_input',
    status: item.completed ? 'completed' : 'pending',
    sort_order: index,
    time_estimate: null,
  };
}

export function PlanQuadrantGrid() {
  const { plans, updateQuadrant, deletePlan } = useMorningPlan();

  const tasks: PlanTask[] = plans.map((item, i) => planItemToTask(item, i));

  const handleTaskMove = (taskId: string, newQuadrant: Quadrant) => {
    updateQuadrant(taskId, newQuadrant);
  };

  const handleDelete = (taskId: string) => {
    deletePlan(taskId);
  };

  return (
    <EisenhowerMatrix
      tasks={tasks}
      onTaskMove={handleTaskMove}
      onDelete={handleDelete}
    />
  );
}
