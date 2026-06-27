/**
 * P3 计划列表页 — 四象限矩阵 + 拖拽调整 + 内联编辑。
 * Route: /m/morning-plan/list
 * 对齐 m1-p3.html 设计（提取 body 内 main 内容区）
 */
import { useNavigate } from 'react-router-dom';
import { EisenhowerMatrix } from '@/components/plan/EisenhowerMatrix';
import { usePlanData } from '@/hooks/usePlanData';
import type { Quadrant } from '@/api/plans';
import './morning-plan.css';

export function MorningPlanList() {
  const navigate = useNavigate();
  const {
    plan, tasks, isLoading, error,
    moveTaskQuadrant, updateTask, deleteTask, completePlan,
  } = usePlanData();

  const handleTaskMove = async (taskId: string, newQuadrant: Quadrant) => {
    await moveTaskQuadrant(taskId, newQuadrant);
  };

  const handleToggleComplete = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateTask(taskId, { status: newStatus });
  };

  const handleTitleChange = async (taskId: string, newTitle: string) => {
    await updateTask(taskId, { title: newTitle });
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('确定要删除这个任务吗？')) return;
    await deleteTask(taskId);
  };

  const handleComplete = async () => {
    await completePlan();
    if (plan) {
      navigate('/m/morning-plan/complete');
    }
  };

  if (isLoading) {
    return (
      <div data-module="morning-plan">
        <div className="mp-page" style={{ textAlign: 'center', color: '#999' }}>
          加载计划中…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-module="morning-plan">
        <div className="mp-page" style={{ textAlign: 'center' }}>
          <div style={{ color: '#C03A39', marginBottom: 16 }}>{error}</div>
          <button className="mp-btn-secondary" onClick={() => navigate('/m/morning-plan/chat')}>
            重新规划
          </button>
        </div>
      </div>
    );
  }

  if (!plan || tasks.length === 0) {
    return (
      <div data-module="morning-plan">
        <div className="mp-page" style={{ textAlign: 'center' }}>
          <div style={{ color: '#999', marginBottom: 16 }}>暂无计划任务</div>
          <button
            className="mp-btn-primary"
            style={{ width: 'auto', padding: '12px 48px', display: 'inline-block' }}
            onClick={() => navigate('/m/morning-plan/chat')}
          >
            去规划
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-module="morning-plan">
      <div className="mp-page">
        {/* 品牌标语区（紧凑版） */}
        <div className="mp-hero__slogan" style={{ marginBottom: 8 }}>日耕朝夕，耕愈工作，耕暖生活</div>
        <div className="mp-hero__divider" style={{ margin: '0 0 12px 0' }} />

        {/* 四象限矩阵（含进度条和标题） */}
        <div style={{ marginBottom: 40 }}>
          <EisenhowerMatrix
            tasks={tasks}
            onTaskMove={handleTaskMove}
            onToggleComplete={handleToggleComplete}
            onTitleChange={handleTitleChange}
            onDelete={handleDelete}
          />
        </div>

        {/* 底部操作按钮 */}
        <div className="mp-actions">
          <button className="mp-btn-secondary" onClick={() => navigate('/m/morning-plan/chat')}>
            继续规划
          </button>
          <button
            className="mp-btn-primary"
            style={{ width: 'auto', padding: '12px 48px', display: 'inline-block' }}
            onClick={handleComplete}
          >
            确认计划
          </button>
        </div>

        {/* 操作提示 */}
        <div style={{ textAlign: 'center', marginTop: 24, color: '#bbb', fontSize: 12 }}>
          提示：拖拽卡片调整象限 · 双击标题编辑 · 点击圆圈标记完成 · 悬停右侧显示删除按钮
        </div>
      </div>
    </div>
  );
}
