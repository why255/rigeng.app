/**
 * P2 工具库 — HR八大模块选择 + 底部引导式生成。
 * Route: /m/smart-office/tool-library
 * 对齐 m6-p2-mobile.html 设计规范。
 *
 * 使用 so-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './smart-office.css';

/* ── HR八大模块数据（对齐后端 GET /office/modules） ── */
interface HrModule {
  key: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  bubble: string;
  chips: { label: string; toolKey: string }[];
}

const HR_MODULES: HrModule[] = [
  {
    key: 'strategy_decode', name: '战略解码', icon: 'mingcute:target-line', color: '#6B8FBF',
    desc: 'BSC战略地图/SWOT/KPI分解树',
    bubble: '姐，需要生成什么类型的战略解码文档？',
    chips: [
      { label: '战略地图', toolKey: 'strategy_map' },
      { label: 'SWOT分析', toolKey: 'swot_analysis' },
      { label: 'KPI分解树', toolKey: 'kpi_tree' },
    ],
  },
  {
    key: 'hr_planning', name: '人资规划', icon: 'mingcute:group-line', color: '#D4A574',
    desc: '需求预测/组织架构/预算方案',
    bubble: '姐，需要生成什么类型的人资规划文档？',
    chips: [
      { label: '人才需求预测', toolKey: 'demand_forecast' },
      { label: '组织架构图', toolKey: 'org_chart' },
      { label: 'HR预算方案', toolKey: 'budget_plan' },
      { label: '继任者计划', toolKey: 'succession_plan' },
    ],
  },
  {
    key: 'recruitment', name: '招聘配置', icon: 'mingcute:user-add-line', color: '#6B8F6B',
    desc: 'JD/面试指引/入职方案',
    bubble: '姐，需要生成什么类型的招聘文档？',
    chips: [
      { label: 'JD生成器', toolKey: 'jd_generator' },
      { label: '面试指引', toolKey: 'interview_guide' },
      { label: '入职方案', toolKey: 'onboarding_plan' },
    ],
  },
  {
    key: 'training_dev', name: '培训开发', icon: 'mingcute:mortarboard-line', color: '#E8A94D',
    desc: '培训体系/课程目录/职业路径',
    bubble: '姐，需要生成什么类型的培训方案？',
    chips: [
      { label: '培训体系方案', toolKey: 'training_system' },
      { label: '课程目录', toolKey: 'course_catalog' },
      { label: '职业发展路径', toolKey: 'career_path' },
    ],
  },
  {
    key: 'compensation', name: '薪酬福利', icon: 'mingcute:currency-dollar-line', color: '#BC6B8F',
    desc: '薪酬结构/奖金方案/福利包',
    bubble: '姐，需要生成什么类型的薪酬福利方案？',
    chips: [
      { label: '薪酬结构设计', toolKey: 'salary_structure' },
      { label: '奖金方案', toolKey: 'bonus_scheme' },
      { label: '福利包设计', toolKey: 'benefit_package' },
    ],
  },
  {
    key: 'performance', name: '绩效管理', icon: 'mingcute:chart-bubble-line', color: '#8F6BBF',
    desc: 'OKR框架/KPI考核/面谈指引',
    bubble: '姐，需要生成什么类型的绩效管理方案？',
    chips: [
      { label: 'OKR框架', toolKey: 'okr_framework' },
      { label: 'KPI考核表', toolKey: 'kpi_sheet' },
      { label: '绩效面谈指引', toolKey: 'review_template' },
    ],
  },
  {
    key: 'employee_relations', name: '员工关系', icon: 'mingcute:user-heart-line', color: '#6BA4B8',
    desc: '合同/员工手册/离职流程',
    bubble: '姐，需要生成什么类型的员工管理文档？',
    chips: [
      { label: '合同模板', toolKey: 'contract_template' },
      { label: '员工手册', toolKey: 'handbook' },
      { label: '离职流程', toolKey: 'exit_procedure' },
    ],
  },
  {
    key: 'corp_culture', name: '企业文化', icon: 'mingcute:home-heart-line', color: '#D46B6B',
    desc: '文化手册/团建方案/认可计划',
    bubble: '姐，需要生成什么类型的企业文化方案？',
    chips: [
      { label: '企业文化手册', toolKey: 'culture_manual' },
      { label: '团建方案', toolKey: 'team_building' },
      { label: '员工认可计划', toolKey: 'recognition_program' },
    ],
  },
];

export function SmartOfficeToolLibrary() {
  const navigate = useNavigate();
  const [selectedModule, setSelectedModule] = useState<HrModule | null>(null);
  const [selectedChip, setSelectedChip] = useState<{ label: string; toolKey: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectModule = useCallback((mod: HrModule) => {
    if (selectedModule?.key === mod.key) {
      setSelectedModule(null);
      setSelectedChip(null);
    } else {
      setSelectedModule(mod);
      setSelectedChip(null);
    }
  }, [selectedModule]);

  const handleSelectChip = useCallback((chip: { label: string; toolKey: string }) => {
    if (selectedChip?.toolKey === chip.toolKey) {
      setSelectedChip(null);
    } else {
      setSelectedChip(chip);
    }
  }, [selectedChip]);

  const handleGenerate = () => {
    if (!selectedModule) return;
    setLoading(true);

    const toolKey = selectedChip ? selectedChip.toolKey : '';
    const toolLabel = selectedChip ? selectedChip.label : selectedModule.name;

    setTimeout(() => {
      setLoading(false);
      navigate(
        `/m/smart-office/ai-guide?module=${encodeURIComponent(selectedModule.key)}&name=${encodeURIComponent(selectedModule.name)}&tool=${encodeURIComponent(toolKey)}&toolLabel=${encodeURIComponent(toolLabel)}`,
      );
    }, 800);
  };

  return (
    <div className="so-page" style={{ position: 'relative' }}>
      {/* ===== 顶部 Header ===== */}
      <header className="so-header">
        <button className="so-header__back" onClick={() => navigate(-1)}>
          <Icon icon="solar:alt-arrow-left-linear" style={{ fontSize: '24px' }} />
        </button>
        <span className="so-header__title">工具库</span>
        <div className="so-header__spacer" />
      </header>

      <main className="so-main" style={{ paddingBottom: 220 }}>
        <div className="so-main-pad">
          {/* 品牌副标题 */}
          <div className="so-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#333', marginTop: 4 }}>
            告别碎片化，高效又专业
          </h1>

          {/* HR八大模块卡片 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {HR_MODULES.map((mod) => {
              const isActive = selectedModule?.key === mod.key;
              return (
                <div
                  key={mod.key}
                  className={`so-module-card${isActive ? ' so-module-card--active' : ''}`}
                  onClick={() => handleSelectModule(mod)}
                >
                  <div className="so-module-card__icon" style={{ backgroundColor: `${mod.color}15` }}>
                    <Icon icon={mod.icon} style={{ fontSize: '20px', color: mod.color }} />
                  </div>
                  <div className="so-module-card__body">
                    <div className="so-module-card__name">{mod.name}</div>
                    <div className="so-module-card__desc">{mod.desc}</div>
                  </div>
                  {isActive && (
                    <div className="so-module-card__check">
                      <Icon icon="mingcute:check-circle-fill" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ===== 底部引导区 (Composer Bar) ===== */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <div className="so-composer">
          {/* 小耕气泡 */}
          <div className="so-composer__bubble-row">
            <div className="so-composer__avatar">耕</div>
            <div className="so-composer__bubble">
              {selectedModule
                ? selectedModule.bubble
                : '姐，请先选择一个人力资源模块'}
            </div>
          </div>

          {/* 工具 Chips */}
          {selectedModule && (
            <div className="so-composer__chips">
              {selectedModule.chips.map((chip) => {
                const isChipActive = selectedChip?.toolKey === chip.toolKey;
                return (
                  <span
                    key={chip.toolKey}
                    className={`so-composer__chip${isChipActive ? ' so-composer__chip--active' : ''}`}
                    onClick={() => handleSelectChip(chip)}
                  >
                    {chip.label}
                  </span>
                );
              })}
            </div>
          )}

          {/* 生成按钮 / Loading */}
          {loading ? (
            <div className="so-composer__loading">
              <div className="so-composer__spinner">耕</div>
              <span className="so-composer__loading-text">小耕在整理思路…</span>
            </div>
          ) : (
            <button
              className="so-composer__btn"
              disabled={!selectedModule}
              onClick={handleGenerate}
            >
              {selectedModule
                ? selectedChip
                  ? '生成文档'
                  : '生成文档（AI自动引导补全信息）'
                : '请先选择模块和工具'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
