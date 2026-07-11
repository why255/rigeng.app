"""智能办公服务 — 请求/响应模型（步骤19）。

覆盖：
- 工具库：HR八大模块单点智能文档生成
- 体系库：战略解码→模块搭建6步闭环
- 文档管理：生成/版本/回滚/归档/协作
"""
from __future__ import annotations

from pydantic import BaseModel, Field


# ═══════ 工具库 ═══════

class ToolCard(BaseModel):
    """工具卡片。"""
    tool_key: str
    title: str
    description: str = ""
    icon: str = ""  # iconify 图标名
    doc_template: str = ""  # 文档模板类型


class ModuleCategory(BaseModel):
    """HR模块分类。"""
    module_key: str
    module_name: str
    description: str = ""
    icon: str = ""
    color: str = "#6B8FBF"
    tools: list[ToolCard] = []


class ToolLibraryResponse(BaseModel):
    """工具库列表响应。"""
    modules: list[ModuleCategory] = []


# ═══════ 体系库：6步搭建 ═══════

class SystemStepQuestion(BaseModel):
    """体系库某步的引导问题。"""
    step_num: int
    step_title: str
    question: str = ""
    hint: str = ""  # 引导提示
    example_answer: str = ""  # 示例答案
    completed: bool = False


class SystemBuildStartRequest(BaseModel):
    """开始体系搭建请求。"""
    project_title: str = Field(default="HR体系搭建", min_length=1, max_length=200)


class SystemBuildStartResponse(BaseModel):
    """开始体系搭建响应。"""
    build_id: str
    project_title: str
    current_step: int = 1
    status: str = "in_progress"
    steps: list[SystemStepQuestion] = []


class StepAnswerRequest(BaseModel):
    """提交步骤答案请求。"""
    build_id: str
    answer: str = Field(..., min_length=1, max_length=5000)


class StepAnswerResponse(BaseModel):
    """步骤答案响应。"""
    build_id: str
    step_num: int
    completed: bool
    next_step: int | None = None  # None 表示已完成全部6步
    is_final: bool = False
    step_title: str = ""


# ═══════ 文档生成 ═══════

class DocumentGenerateRequest(BaseModel):
    """AI生成文档请求。"""
    module_key: str = Field(..., description="HR八大模块key")
    doc_type: str = Field(default="tool", pattern="^(tool|system)$")
    tool_key: str | None = None  # 工具库的tool_key
    build_id: str | None = None  # 体系库的build_id
    custom_prompt: str | None = None  # 自定义补充说明
    brand_logo_visible: bool = True  # 品牌标识是否可见


class DocumentSection(BaseModel):
    """文档段落。"""
    heading: str = ""
    body: str = ""
    level: int = 1  # 标题层级 1/2/3


class DocumentGenerateResponse(BaseModel):
    """文档生成响应。"""
    doc_id: str
    title: str
    module_key: str
    doc_type: str
    content: list[DocumentSection] = []
    source_tags: list[str] = []  # ["私有库", "携君库", "互联网"]
    regenerate_count: int = 0
    brand_logo_visible: bool = True


# ═══════ 草稿箱 ═══════

class DraftSaveRequest(BaseModel):
    """保存草稿请求。"""
    doc_id: str | None = None
    title: str | None = None
    doc_type: str = "tool"
    module_key: str | None = None
    step_num: int | None = None
    content: dict | None = None  # 内容快照


class DraftListItem(BaseModel):
    """草稿列表项。"""
    id: str
    title: str = ""
    doc_type: str = ""
    module_key: str | None = None
    step_num: int | None = None
    updated_at: str = ""
    days_until_expire: int = 30  # 距自动清理剩余天数


# ═══════ 现有制度比对 ═══════

class PolicyUploadResponse(BaseModel):
    """制度上传响应。"""
    upload_id: str
    original_filename: str
    content_length: int = 0
    uploaded_at: str = ""


class ComparePolicyRequest(BaseModel):
    """制度比对请求。"""
    doc_id: str
    upload_id: str


class CompareDiffItem(BaseModel):
    """差异条目。"""
    section: str = ""  # 段落/章节名
    generated_text: str = ""  # 生成的内容
    existing_text: str = ""  # 现有制度内容
    diff_type: str = ""  # missing / extra / different / match
    suggestion: str = ""  # 升级建议


class ComparePolicyResponse(BaseModel):
    """制度比对响应。"""
    doc_id: str
    upload_id: str
    differences: list[CompareDiffItem] = []
    summary: str = ""  # 比对总结


# ═══════ 版本管理 ═══════

class VersionItem(BaseModel):
    """版本历史项。"""
    id: str
    version_num: int
    created_by: str = ""
    created_at: str = ""
    summary: str = ""  # 版本摘要（前100字）


class VersionHistoryResponse(BaseModel):
    """版本历史响应。"""
    doc_id: str
    versions: list[VersionItem] = []
    current_version: int = 1


class RollbackResponse(BaseModel):
    """版本回滚响应。"""
    doc_id: str
    from_version: int
    to_version: int
    content: list[DocumentSection] = []


# ═══════ 协作 ═══════

class CollaborationInviteRequest(BaseModel):
    """邀请协作请求。"""
    doc_id: str
    teacher_user_id: str  # 被邀请的老师用户ID
    message: str = ""  # 邀请留言


class CollaborationInviteResponse(BaseModel):
    """邀请协作响应。"""
    success: bool = False
    invite_id: str = ""
    message: str = ""


# ═══════ 归档 ═══════

class ArchiveResponse(BaseModel):
    """归档响应。"""
    success: bool = False
    doc_id: str = ""
    kb_doc_id: str = ""


# ═══════ 跨模块数据连接 ═══════

class ModuleConnection(BaseModel):
    """模块间数据连接。"""
    from_module: str = ""
    to_module: str = ""
    data_type: str = ""  # document / action_item / insight
    description: str = ""


class ModuleDataFlowResponse(BaseModel):
    """跨模块数据流配置响应。"""
    connections: list[ModuleConnection] = []


# ── AI 智能办公对话 ──

class OfficeChatIn(BaseModel):
    """智能办公 AI 对话请求 — 所有小耕回复由AI模型生成。"""
    message: str = Field(default="", max_length=4096, description="用户当前消息（初始问候可为空）")
    module_key: str = Field(default="", description="HR模块key")
    module_name: str = Field(default="", description="模块名称")
    tool_key: str = Field(default="", description="工具key")
    tool_label: str = Field(default="", description="工具名称")
    context: list[dict] = Field(default_factory=list, description="对话历史 [{role, text}]")
    question_index: int = Field(default=0, description="已进行到第几个问题")
