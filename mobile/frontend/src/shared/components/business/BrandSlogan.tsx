/**
 * 24d 品牌 Slogan 展示位 — 全站统一组件。
 * 每个模块首页和子页面使用此组件展示品牌语，避免硬编码重复。
 *
 * 用法：
 *   <BrandSlogan module={module} />          // 模块入口页（大字标题）
 *   <BrandSlogan module={module} compact />  // 子页面（小字标题）
 *   <BrandSlogan module={module} dark />     // 暗色主题（情绪树洞）
 */
import type { ModuleMeta } from '../../data/modules'
import { MAIN_SLOGAN } from '../../data/modules'

interface BrandSloganProps {
  /** 模块元数据（提供模块专属 slogan） */
  module?: ModuleMeta
  /** 紧凑模式：标题用 17px 而非 26px */
  compact?: boolean
  /** 暗色模式：文字变浅色 */
  dark?: boolean
  /** 额外的 className */
  className?: string
}

const darkStyle = {
  slogan: { color: 'rgba(255,255,255,0.6)' },
  divider: { background: 'rgba(255,255,255,0.1)' },
  title: { color: '#E0E0E0' },
}

export function BrandSlogan({ module, compact, dark, className }: BrandSloganProps) {
  const s = dark ? darkStyle : { slogan: {}, divider: {}, title: {} }

  return (
    <section
      className={className}
      style={{
        textAlign: 'center',
        marginBottom: compact ? 16 : 32,
      }}
    >
      <div
        style={{
          fontSize: compact ? 13 : 17,
          fontWeight: 700,
          color: dark ? 'rgba(255,255,255,0.6)' : '#333',
          lineHeight: 1.6,
          ...s.slogan,
        }}
      >
        {MAIN_SLOGAN}
      </div>
      <div
        style={{
          width: 96,
          height: 1,
          background: dark ? 'rgba(255,255,255,0.1)' : '#E0D5C7',
          margin: compact ? '8px auto' : '16px auto',
          ...s.divider,
        }}
      />
      <h2
        style={{
          fontSize: compact ? 17 : 26,
          fontFamily: "'ZCOOL XiaoWei', 'Noto Sans SC', serif",
          fontWeight: compact ? 700 : 800,
          color: dark ? '#E0E0E0' : '#333',
          letterSpacing: '0.1em',
          ...s.title,
        }}
      >
        {module?.slogan ?? MAIN_SLOGAN}
      </h2>
    </section>
  )
}
