import { Icon } from '@iconify/react'

/** 占位页面 — 模块尚未实现时使用，后续 Phase 逐个替换 */
export function PlaceholderPage({ title, icon }: { title: string; icon?: string }) {
  return (
    <div className="adm-page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <Icon
        icon={icon || 'mingcute:construction-line'}
        width={48}
        style={{ color: 'var(--color-neutral-300)', marginBottom: 16 }}
      />
      <h2>{title}</h2>
      <p style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--font-size-l5)' }}>
        该模块正在开发中，敬请期待...
      </p>
    </div>
  )
}
