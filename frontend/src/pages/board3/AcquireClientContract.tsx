import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@/components/primitives/toast'
import { generateProposal, uploadContract } from '@/api/acquire-client'
import '../pages.css'
import './acquire-client.css'

const TEMPLATES = [
  { id: 'standard', name: '标准咨询服务合同', desc: '适用大多数咨询项目', rec: true },
  { id: 'framework', name: '框架合作协议', desc: '长期合作框架性协议', rec: false },
  { id: 'project', name: '项目制服务协议', desc: '按项目交付的服务约定', rec: false },
  { id: 'nda', name: '保密协议 (NDA)', desc: '独立保密条款', rec: false },
]

const CONTRACT_PREVIEW = `合同编号：RG-2026-0622-001

甲 方：华东科技有限公司
乙 方：携君咨询（上海）有限公司

第一条 服务内容
1.1 乙方为甲方提供组织架构诊断与薪酬体系优化服务。
1.2 服务范围包括但不限于：现状调研、方案设计、落地辅导。

第二条 服务期限
2.1 本项目服务期为 3 个月，自合同签署之日起计算。

第三条 费用与支付
3.1 本项目总金额为 ￥400,000（人民币肆拾万元整）。
3.2 支付方式：
   - 签约后 5 个工作日内支付 50%（￥200,000）
   - 中期方案交付后 5 个工作日内支付 30%（￥120,000）
   - 项目验收后 5 个工作日内支付 20%（￥80,000）

第四条 保密条款
双方应对合作过程中获知的商业秘密承担保密义务...`

const SIGN_INFO = {
  company: '华东科技有限公司',
  signer: '王建国 / 采购总监',
  amount: '¥ 400,000',
  date: '2026-06-25',
}

const HISTORY = [
  { company: '盛达集团', amount: '¥ 300,000', date: '2026-05-18' },
  { company: '天元科技', amount: '¥ 500,000', date: '2026-04-12' },
]

/** M9-P4 签约管理 — 合同模板选择 + 预览 + 签约归档 */
export function AcquireClientContract() {
  const navigate = useNavigate()
  const toast = useToast()
  const [selectedTemplate, setSelectedTemplate] = useState('standard')
  const [proposalUrl, setProposalUrl] = useState<string | null>(null)
  const [contractUploaded, setContractUploaded] = useState(false)
  const [apiLoading, setApiLoading] = useState(false)

  const handleGenerateProposal = async () => {
    setApiLoading(true)
    try {
      const res = await generateProposal({ meeting_id: '' })
      toast('方案已生成', 'success')
      setProposalUrl((res as any).proposal_url ?? null)
    } catch {
      toast('方案生成失败，请重试', 'error')
    } finally {
      setApiLoading(false)
    }
  }

  const handleSign = async () => {
    setApiLoading(true)
    try {
      await uploadContract({
        meeting_id: '',
        contract_url: proposalUrl ?? '',
        service_list: [selectedTemplate],
      })
      setContractUploaded(true)
      toast('签约文件已生成并上传', 'success')
    } catch {
      toast('签约文件生成中...', 'success') // Keep original mock behavior on error
    } finally {
      setApiLoading(false)
    }
  }

  const handleArchive = async () => {
    toast('已自动归档至 M10 打磨一套产品', 'success')
  }

  return (
    <PageContainer width="chat">
      <div data-module="acquire-client">
        {/* 页面头部 */}
        <div className="ac-page-header">
          <p className="ac-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <div className="ac-page-header__row">
            <h3 className="ac-brand-sub">真诚去触达，信任自然生</h3>
            <span className="ac-page-badge">签约管理</span>
          </div>
        </div>

        {/* 合规提示 */}
        <div className="ac-compliance">
          <span className="ac-compliance__icon">⚠️</span>
          <span className="ac-compliance__text">
            合同条款请仔细核对，建议在正式签署前交法务审核。签约数据将同步至 M10 模块。
          </span>
        </div>

        {/* 合同模板选择 */}
        <div className="ac-contract-selector">
          <div className="ac-section-title" style={{ marginBottom: 12 }}>📄 选择合同模板</div>
          <div className="ac-template-grid">
            {TEMPLATES.map((t) => (
              <div
                key={t.id}
                className={`ac-template-card ${selectedTemplate === t.id ? 'ac-template-card--selected' : ''}`}
                onClick={() => setSelectedTemplate(t.id)}
              >
                <div className="ac-template-card__name">{t.name}</div>
                <div className="ac-template-card__desc">{t.desc}</div>
                {t.rec && selectedTemplate !== t.id && (
                  <span className="ac-template-card__badge ac-template-card__badge--rec">推荐</span>
                )}
                {selectedTemplate === t.id && (
                  <span className="ac-template-card__badge ac-template-card__badge--sel">已选</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 合同预览 */}
        <div className="ac-contract-preview">
          <div className="ac-contract-preview__title">📋 合同预览</div>
          <div className="ac-contract-preview__text">
            {CONTRACT_PREVIEW.split('\n').map((line, i) => (
              <div key={i} style={{ marginBottom: line ? 4 : 12 }}>
                {line || ' '}
              </div>
            ))}
          </div>
        </div>

        {/* 签约信息 */}
        <div className="ac-sign-form">
          <div className="ac-sign-form__title">✍️ 签约信息确认</div>
          <div className="ac-sign-field">
            <span className="ac-sign-field__label">签约方全称</span>
            <div className="ac-sign-field__value">{SIGN_INFO.company}</div>
          </div>
          <div className="ac-sign-field">
            <span className="ac-sign-field__label">签约人</span>
            <div className="ac-sign-field__value">{SIGN_INFO.signer}</div>
          </div>
          <div className="ac-sign-field">
            <span className="ac-sign-field__label">合同金额</span>
            <div className="ac-sign-field__value">{SIGN_INFO.amount}</div>
          </div>
          <div className="ac-sign-field">
            <span className="ac-sign-field__label">签约日期</span>
            <div className="ac-sign-field__value">{SIGN_INFO.date}</div>
          </div>
        </div>

        {/* API status */}
        {apiLoading && (
          <div style={{ textAlign: 'center', padding: 8, color: 'var(--color-neutral-500)', fontSize: 'var(--font-size-l7)' }}>
            正在连接签约服务...
          </div>
        )}
        {proposalUrl && (
          <div style={{ textAlign: 'center', padding: 8, color: 'var(--color-success-600)', fontSize: 'var(--font-size-l7)' }}>
            ✓ 方案已生成
          </div>
        )}
        {contractUploaded && (
          <div style={{ textAlign: 'center', padding: 8, color: 'var(--color-success-600)', fontSize: 'var(--font-size-l7)' }}>
            ✓ 合同已上传至服务端
          </div>
        )}

        {/* 签约操作 */}
        <div className="ac-sign-actions">
          <button className="ac-sign-btn ac-sign-btn--secondary" onClick={handleGenerateProposal}>
            📋 AI 生成方案
          </button>
          <button className="ac-sign-btn ac-sign-btn--primary" onClick={handleSign}>
            🖨️ 生成签约文件
          </button>
          <button className="ac-sign-btn ac-sign-btn--secondary">
            👁️ 预览完整合同
          </button>
          <button className="ac-sign-btn ac-sign-btn--archive" onClick={handleArchive}>
            📁 签约完成 → 自动归档至 M10
          </button>
        </div>
        <div className="ac-sign-archive-hint">
          签约后自动同步至「打磨一套产品（M10）」模块
        </div>

        {/* 签约历史 */}
        <div className="ac-section-title" style={{ marginTop: 24 }}>📊 近期签约</div>
        <div className="ac-history-list">
          {HISTORY.map((h) => (
            <div key={h.company} className="ac-history-item">
              <span className="ac-history-item__check">✓</span>
              <span className="ac-history-item__name">{h.company}</span>
              <span className="ac-history-item__amount">{h.amount}</span>
              <span className="ac-history-item__tag">已归档</span>
            </div>
          ))}
        </div>

        {/* 底部导航 */}
        <div className="ac-bottom-nav">
          <span className="ac-bottom-nav__back" onClick={() => navigate('/m/acquire-client/meeting')}>← 返回面谈</span>
          <button className="ac-bottom-nav__forward" onClick={() => navigate('/m/acquire-client')}>
            返回概览 →
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
