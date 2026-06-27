"""ORM 模型注册（步骤7+：全模块覆盖，不再滞后于迁移脚本）。"""
# ⚠️  命名冲突说明：
#   DocumentVersion 出现在 knowledge (表 document_version) 和 office (表 office_document_version) 中，
#   CompanyIntel 出现在 career (表 company_intel) 和 acquire_client (表 acquire_company_intel) 中。
#   后导入者会覆盖前者的符号——此处以别名隔离，避免静默覆盖。
from .user import (  # noqa: F401
    User, UserDisclaimer, VipMembership, TeacherProfile, TeacherAssignment,
    ContributionBalance, ContributionLog, Referral, AuthorizationGrant,
)
from .knowledge import (  # noqa: F401
    Document, DocumentVersion, Folder, DocTag, FileObject, AuditQueue,
    GrowthReplayMaterial, ContentPolicyRule,
)
from .plan import Plan, PlanTask  # noqa: F401
from .review import ReviewRecord  # noqa: F401
from .vector_index import VectorIndex  # noqa: F401
from .security import CourageValue, CrisisLog, LocalEncryptedStorage  # noqa: F401
from .analytics import EventLog, MetricDaily, CarePushLog, SmsSendLog, PushRuleTemplate  # noqa: F401
from .emotion_score import EmotionScore  # noqa: F401
from .emotion import GrowthRecord  # noqa: F401
from .qa import QaConversation, QaAnswer, QaFeedback  # noqa: F401
from .recording import (  # noqa: F401
    Recording, TranscriptSegment, ExtractionResult, ActionItem,
)
from .office import (  # noqa: F401
    OfficeDocument, SystemBuildState, OfficeDraft,
    DocumentVersion as OfficeDocumentVersion,  # 别名，避免覆盖 knowledge.DocumentVersion
    PolicyUpload,
)
from .career import (  # noqa: F401
    CareerProgress, STARExtraction, SkillCrystal, JobApplication,
    InterviewPrep, InterviewReview, OfferComparison, ProbationPlan,
    CompanyIntel,
)
from .product_design import (  # noqa: F401
    ProductProject, DiagnosisReport, QuantifiedTarget, SolutionVersion,
    PreResearchProduct, SolutionReuseRecord, CoachingRecord,
)
from .brand import (  # noqa: F401
    BrandProfile, BrandContent, BrandAnalytics, BrandCourageValue, BrandLead,
)
from .order_delivery import (  # noqa: F401
    DeliveryProject, ProjectTeam, GanttNode, ProjectDocument,
    Issue, ClientMeetingRecord, DeliveryAssistantChat, ProjectArchive,
)
from .acquire_client import (  # noqa: F401
    TransitionSignal, SelfDiagnosis,
    CompanyIntel as AcquireClientIntel,  # 别名，避免覆盖 career.CompanyIntel
    MeetingStrategy, ClientMeeting, NegotiationRound, RoleplaySession,
    ClientContract, ComplianceReminder,
)
