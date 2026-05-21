/**
 * generate-schema-doc.ts
 *
 * Reads every *.ts file under lib/db/src/schema/, parses pgTable definitions,
 * and overwrites .local/docs/database-schema-zh.md with an up-to-date Chinese
 * documentation table.
 *
 * Run:  pnpm tsx scripts/src/generate-schema-doc.ts
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Paths — resolved relative to this script file so they work regardless of CWD
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/src/ → up two levels → workspace root
const WORKSPACE_ROOT = resolve(__dirname, "..", "..");
const SCHEMA_DIR = join(WORKSPACE_ROOT, "lib/db/src/schema");
const OUTPUT_FILE = join(WORKSPACE_ROOT, ".local/docs/database-schema-zh.md");

// ---------------------------------------------------------------------------
// Module groupings — defines the order and sections in the output document.
// Tables not listed here are appended to a catch-all section at the end.
// ---------------------------------------------------------------------------
const MODULES: Array<{ title: string; tables: string[] }> = [
  {
    title: "一、用户体系",
    tables: ["users", "opc_profiles", "publisher_profiles", "refresh_tokens", "settlement_accounts"],
  },
  {
    title: "二、需求与撮合",
    tables: ["demands", "demand_payments", "bids", "orders", "deliverables"],
  },
  {
    title: "三、作品集与等级认证",
    tables: ["portfolios"],
  },
  {
    title: "四、报价卡体系",
    tables: ["quote_dimensions", "quote_tiers", "quote_card_configs"],
  },
  {
    title: "五、通知",
    tables: ["notifications"],
  },
  {
    title: "六、AI 智能体",
    tables: ["llm_providers", "agent_configs", "agent_conversations"],
  },
  {
    title: "七、培训与课程",
    tables: ["courses", "enrollments", "learning_resources"],
  },
  {
    title: "八、活动与报名",
    tables: ["activities", "activity_fields", "registrations", "registration_tags"],
  },
  {
    title: "九、内容生态",
    tables: ["posts", "post_likes", "post_comments", "announcements"],
  },
  {
    title: "十、管理后台",
    tables: ["admin_roles", "admin_role_assignments", "sensitive_words", "site_settings", "system_logs"],
  },
];

// ---------------------------------------------------------------------------
// Table metadata: Chinese name + one-line description
// ---------------------------------------------------------------------------
const TABLE_META: Record<string, { zh: string; desc: string }> = {
  users: { zh: "用户主表", desc: "平台所有账号的核心表，OPC、发单方、管理员均在此。" },
  opc_profiles: { zh: "OPC 专属资料", desc: "每个 OPC 账号对应一行，存储接单能力、信誉等数据。" },
  publisher_profiles: { zh: "发单方资料", desc: "每个发单方账号对应一行，存储企业信息。" },
  refresh_tokens: { zh: "登录刷新令牌", desc: "存储每个用户的 JWT Refresh Token，用于无感续签登录态。" },
  settlement_accounts: { zh: "结算账户", desc: "OPC 或发单方提交的打款/收款银行信息，需管理员审核。" },
  demands: { zh: "需求单", desc: "发单方发布的项目需求，是整个撮合流程的起点。" },
  demand_payments: { zh: "需求发布费用支付记录", desc: "发单方在需求审核通过后需缴纳的平台服务费记录。" },
  bids: { zh: "投标 / 报价记录", desc: "OPC 对某条需求提交的竞标申请。" },
  orders: { zh: "订单", desc: "需求被选标后正式生成的合同订单。" },
  deliverables: { zh: "交付物", desc: "OPC 在订单执行过程中提交的阶段性或最终成果。" },
  portfolios: { zh: "OPC 作品集 / 作品认证", desc: "OPC 的作品展示记录，同时承载等级认证申请流程。" },
  quote_dimensions: { zh: "报价维度定义", desc: "报价卡的维度目录，定义每个服务品类下有哪些可量化的计价维度。" },
  quote_tiers: { zh: "报价档位定义", desc: "每个维度下的档位选项（S / M / L / XL），含对应定价或系数。" },
  quote_card_configs: {
    zh: "报价卡平台定价配置（旧版）",
    desc: "⚠️ 早期版本的报价卡配置表，每行对应一个维度-档位组合。现已被 `quote_dimensions` + `quote_tiers` 两表替代，保留用于兼容。",
  },
  notifications: { zh: "站内通知", desc: "推送给用户的系统通知，覆盖所有业务事件。" },
  llm_providers: { zh: "大模型供应商配置", desc: "平台接入的 AI 大模型服务商，由管理员配置。" },
  agent_configs: { zh: "AI 智能体场景配置", desc: "每个业务场景（如需求分析、合同生成）对应一条 Agent 配置。" },
  agent_conversations: { zh: "AI 对话历史", desc: "用户与 AI 智能体的完整对话记录。" },
  courses: { zh: "课程", desc: "平台提供的 OPC 培训课程。" },
  enrollments: { zh: "选课记录", desc: "用户报名课程的记录，含学习进度与支付状态。" },
  learning_resources: { zh: "学习资料库", desc: "平台统一维护的公开学习资源（文档、视频等）。" },
  activities: { zh: "线上/线下活动", desc: "平台运营发布的活动（培训会、沙龙等）。" },
  activity_fields: { zh: "活动报名自定义字段", desc: "每个活动可配置不同的报名表单字段。" },
  registrations: { zh: "活动报名记录", desc: "用户提交的活动报名信息。" },
  registration_tags: { zh: "报名者标签", desc: "管理员为报名者打的标签，便于筛选管理。" },
  posts: { zh: "社区帖子", desc: "OPC 或发单方发布的内容帖子（案例、经验分享等）。" },
  post_likes: { zh: "帖子点赞", desc: "记录谁对哪篇帖子点了赞。" },
  post_comments: { zh: "帖子评论", desc: "帖子下的评论记录。" },
  announcements: { zh: "公告 / 法律文档", desc: "平台公告、隐私政策、用户协议等内容。" },
  admin_roles: { zh: "管理员角色", desc: "管理后台的角色定义（如「财务审核员」、「内容审核员」）。" },
  admin_role_assignments: { zh: "管理员角色分配", desc: "将角色与具体管理员用户关联（多对多）。" },
  sensitive_words: { zh: "敏感词库", desc: "平台内容审核使用的敏感词列表。" },
  site_settings: { zh: "系统全局配置", desc: "键值对形式存储的系统配置项（如平台费率、公告开关等）。" },
  system_logs: { zh: "系统操作日志", desc: "记录管理员操作、系统事件等关键行为日志。" },
};

// ---------------------------------------------------------------------------
// Column metadata: "table.column" → Chinese field description
// For columns not listed here, the column name itself is used as a fallback.
// ---------------------------------------------------------------------------
const FIELD_META: Record<string, string> = {
  // ---- common ----
  "*.id": "ID",
  "*.created_at": "创建时间",
  "*.updated_at": "最后更新时间",
  "*.user_id": "关联用户",
  "*.status": "状态",
  "*.is_active": "是否启用",
  "*.sort_order": "排列顺序",
  "*.description": "描述",
  "*.title": "标题",
  "*.file_url": "文件 URL",
  "*.file_type": "文件类型",
  "*.file_size": "文件大小（字节）",
  "*.refund_reason": "退款原因",
  "*.refund_order_no": "退款流水号",
  "*.refunded_at": "退款完成时间",
  "*.refund_requested_at": "退款申请时间",
  "*.refund_reject_reason": "拒绝退款原因",

  // ---- users ----
  "users.nickname": "昵称",
  "users.email": "邮箱（唯一）",
  "users.password_hash": "密码哈希",
  "users.phone": "手机号（非空时唯一）",
  "users.avatar": "头像 URL",
  "users.title": "个人称谓/头衔",
  "users.role": "角色：`opc` / `publisher` / `admin`",
  "users.status": "账号状态：`active` / `suspended` / `banned`",
  "users.is_super_admin": "是否超级管理员",

  // ---- opc_profiles ----
  "opc_profiles.id": "资料 ID",
  "opc_profiles.user_id": "关联用户",
  "opc_profiles.level": "OPC 等级：`newbie` / `C` / `B` / `A`",
  "opc_profiles.bio": "个人简介",
  "opc_profiles.skill_tags": "技能标签列表",
  "opc_profiles.industry_tags": "行业标签列表",
  "opc_profiles.credit_score": "信誉分（默认 4.0）",
  "opc_profiles.total_orders": "累计接单数",
  "opc_profiles.completion_rate": "完成率",
  "opc_profiles.avg_rating": "平均评分",
  "opc_profiles.total_earnings": "累计收益（元）",
  "opc_profiles.activity_score": "活跃度评分",
  "opc_profiles.title": "职位/头衔",
  "opc_profiles.location": "所在城市",
  "opc_profiles.website": "个人网站",
  "opc_profiles.years_exp": "工作年限",
  "opc_profiles.wechat": "微信号",
  "opc_profiles.avatar": "头像 URL（独立于 users 表）",

  // ---- publisher_profiles ----
  "publisher_profiles.user_id": "关联用户（主键）",
  "publisher_profiles.company_desc": "公司简介",
  "publisher_profiles.location": "公司所在地",
  "publisher_profiles.industry": "所属行业",
  "publisher_profiles.team_size": "团队规模",
  "publisher_profiles.founded_year": "成立年份",
  "publisher_profiles.website": "公司网站",
  "publisher_profiles.contact_email": "联系邮箱",
  "publisher_profiles.credit_code": "统一社会信用代码",
  "publisher_profiles.company_logo": "公司 Logo URL",

  // ---- refresh_tokens ----
  "refresh_tokens.user_id": "关联用户（主键，每人最多一个）",
  "refresh_tokens.token_hash": "Token 哈希值（唯一索引）",
  "refresh_tokens.expires_at": "过期时间",

  // ---- settlement_accounts ----
  "settlement_accounts.user_id": "关联用户",
  "settlement_accounts.company_name": "公司名称",
  "settlement_accounts.credit_code": "统一社会信用代码",
  "settlement_accounts.bank_name": "开户银行名称",
  "settlement_accounts.bank_branch": "开户支行",
  "settlement_accounts.bank_account": "银行账号",
  "settlement_accounts.account_name": "开户名",
  "settlement_accounts.contact_name": "联系人姓名",
  "settlement_accounts.contact_phone": "联系人电话",
  "settlement_accounts.business_license_url": "营业执照图片 URL",
  "settlement_accounts.legal_rep_id_front_url": "法人身份证正面 URL",
  "settlement_accounts.legal_rep_id_back_url": "法人身份证背面 URL",
  "settlement_accounts.reject_reason": "审核拒绝原因",
  "settlement_accounts.status": "审核状态：`pending` / `verified` / `rejected`",

  // ---- demands ----
  "demands.demand_no": "需求编号（唯一，显示用）",
  "demands.title": "需求标题",
  "demands.type": "类型：`education` / `software` / `marketing` / `content` / `other`",
  "demands.description": "需求详细描述",
  "demands.skill_tags": "需要的技能标签",
  "demands.opc_level": "要求的 OPC 等级（`any` 表示不限）",
  "demands.budget": "⚠️ 已废弃，兼容字段",
  "demands.budget_min": "预算下限（元）",
  "demands.budget_max": "预算上限（元）",
  "demands.deadline": "项目截止日期",
  "demands.milestones": "里程碑列表，每项含名称、截止日、交付说明、状态",
  "demands.attachments": "附件列表，每项含文件名、大小、类型、URL",
  "demands.mode": "接单模式：`open`（公开抢单）/ `directed`（定向邀约）",
  "demands.status": "需求状态（见下方状态说明）",
  "demands.is_urgent": "是否紧急",
  "demands.bid_deadline": "抢单截止时间",
  "demands.publisher_id": "发单方用户 ID",
  "demands.directed_opc_ids": "定向邀约的 OPC ID 列表",
  "demands.summary": "AI 生成的需求摘要",
  "demands.rejection_reason": "审核拒绝原因",

  // ---- demand_payments ----
  "demand_payments.demand_id": "关联需求",
  "demand_payments.amount": "支付金额（元）",
  "demand_payments.method": "支付方式：`online` / `offline`",
  "demand_payments.status": "支付状态：`pending` / `confirmed` / `rejected` / `refund_pending` / `refunding` / `refunded`",
  "demand_payments.payment_order_no": "在线支付流水号",
  "demand_payments.receipt_url": "线下支付凭证图片 URL",
  "demand_payments.payment_note": "支付备注",
  "demand_payments.reject_reason": "拒绝原因（管理员驳回时填写）",
  "demand_payments.confirmed_by": "确认收款的管理员 ID",
  "demand_payments.confirmed_at": "确认时间",
  "demand_payments.refund_order_no": "退款流水号",
  "demand_payments.refunded_at": "退款完成时间",
  "demand_payments.refund_reason": "退款原因",
  "demand_payments.refund_requested_at": "退款申请时间",
  "demand_payments.refund_reject_reason": "拒绝退款的原因",
  "demand_payments.refund_receipt_url": "退款凭证图片 URL",

  // ---- bids ----
  "bids.demand_id": "关联需求",
  "bids.opc_id": "投标的 OPC 用户 ID",
  "bids.proposal": "文字方案 / 自我介绍",
  "bids.estimated_days": "预计交付天数",
  "bids.portfolio_links": "附上的作品集链接",
  "bids.quote_card_data": "报价卡维度选择：`{维度代码: 档位代码}`",
  "bids.quote_card_snapshot": "提交时报价卡的完整快照（含计算明细，不可变）",
  "bids.quoted_price": "最终报价金额（元）",
  "bids.status": "状态：`pending`（待处理）/ `accepted`（已接受）/ `rejected`（已拒绝）/ `withdrawn`（已撤回）",

  // ---- orders ----
  "orders.order_no": "订单编号（唯一）",
  "orders.demand_id": "关联需求",
  "orders.opc_id": "承接的 OPC",
  "orders.publisher_id": "发单方",
  "orders.amount": "订单总金额（元）",
  "orders.opc_share": "OPC 实收金额（元）",
  "orders.publisher_share": "发单方实付金额（元）",
  "orders.platform_fee": "平台服务费（元）",
  "orders.status": "订单状态：`pending_payment` / `in_progress` / `pending_acceptance` / `completed` / `closed` / `disputed`",
  "orders.milestones": "里程碑列表（同 demands 表结构）",
  "orders.rating": "发单方对 OPC 的评分",
  "orders.review_comment": "发单方评价内容",
  "orders.opc_rating": "OPC 对发单方的评分",
  "orders.opc_review_comment": "OPC 对发单方的评价",
  "orders.deadline": "订单交付截止日",
  "orders.payment_method": "支付方式：`online` / `offline`",
  "orders.payment_receipt_url": "线下支付凭证 URL",
  "orders.payment_note": "支付备注",
  "orders.payment_order_no": "在线支付流水号",
  "orders.paid_at": "付款确认时间（此后进入 in_progress）",
  "orders.payment_reject_reason": "管理员驳回支付凭证的原因",

  // ---- deliverables ----
  "deliverables.order_id": "关联订单",
  "deliverables.milestone_id": "关联的里程碑 ID（可为空，表示最终交付）",
  "deliverables.title": "交付物标题",
  "deliverables.description": "交付说明",
  "deliverables.file_url": "附件文件 URL",
  "deliverables.file_name": "附件文件名",
  "deliverables.status": "状态：`submitted`（已提交）/ `approved`（已验收）/ `rejected`（已驳回）",
  "deliverables.feedback": "发单方的反馈/驳回意见",
  "deliverables.submitted_at": "提交时间",

  // ---- portfolios ----
  "portfolios.user_id": "所属 OPC",
  "portfolios.title": "作品标题",
  "portfolios.type": "作品类型（如 education / software 等）",
  "portfolios.cover_image": "封面图 URL",
  "portfolios.description": "作品描述",
  "portfolios.project_url": "项目链接",
  "portfolios.order_id": "关联订单 ID（来自平台实单时填写）",
  "portfolios.rating": "客户评分",
  "portfolios.client_feedback": "客户反馈文字",
  "portfolios.apply_level": "申请认证的目标等级（A / B / C）",
  "portfolios.level_apply_status": "认证审核状态（pending / approved / rejected）",
  "portfolios.level_apply_note": "审核备注（管理员填写）",
  "portfolios.reviewed_at": "审核完成时间",

  // ---- quote_dimensions ----
  "quote_dimensions.category": "所属品类：`software` / `education` / `marketing` / `content` / `other`",
  "quote_dimensions.layer": "所在层：`base`（基础定价层）/ `adjust`（调整系数层）",
  "quote_dimensions.code": "维度代码（如 D1、C1），品类内唯一",
  "quote_dimensions.label": "维度名称（显示用）",
  "quote_dimensions.description": "维度说明",

  // ---- quote_tiers ----
  "quote_tiers.dimension_id": "关联维度",
  "quote_tiers.tier": "档位代码（如 S / M / L / XL）",
  "quote_tiers.tier_label": "档位名称（显示用）",
  "quote_tiers.base_price": "基础价格（元，用于 base 层）",
  "quote_tiers.coefficient": "调整系数（用于 adjust 层，如 1.2）",
  "quote_tiers.description": "档位说明",

  // ---- quote_card_configs ----
  "quote_card_configs.dimension_code": "维度代码（D1–D5 / C1–C4）",
  "quote_card_configs.dimension_label": "维度名称",
  "quote_card_configs.tier": "档位代码（S / M / L / XL）",
  "quote_card_configs.tier_label": "档位名称",
  "quote_card_configs.base_price": "基础价格（元）",
  "quote_card_configs.coefficient": "调整系数",
  "quote_card_configs.description": "说明",

  // ---- notifications ----
  "notifications.user_id": "接收通知的用户",
  "notifications.type": "通知类型（见下方）",
  "notifications.title": "通知标题",
  "notifications.content": "通知正文",
  "notifications.is_read": "是否已读",
  "notifications.responded_action": "用户操作记录（如接受/拒绝邀约）",
  "notifications.related_id": "关联业务 ID（如订单 ID、需求 ID）",
  "notifications.related_type": "关联业务类型（如 `order` / `demand`）",

  // ---- llm_providers ----
  "llm_providers.name": "供应商标识（唯一，如 `deepseek`）",
  "llm_providers.display_name": "显示名称",
  "llm_providers.base_url": "API 接口地址",
  "llm_providers.api_key": "API 密钥",
  "llm_providers.default_model": "默认使用的模型名",
  "llm_providers.remark": "备注",

  // ---- agent_configs ----
  "agent_configs.name": "配置名称",
  "agent_configs.scene_key": "场景唯一标识（如 `demand_analysis`）",
  "agent_configs.system_prompt": "系统提示词",
  "agent_configs.is_enabled": "是否启用",
  "agent_configs.model": "使用的模型（默认 deepseek-chat）",

  // ---- agent_conversations ----
  "agent_conversations.demand_id": "关联需求（可为空）",
  "agent_conversations.session_key": "会话标识（用于区分同一用户不同场景的会话）",
  "agent_conversations.user_id": "对话用户",
  "agent_conversations.messages": "完整消息列表，每条含 `role`、`content`、时间戳等",

  // ---- courses ----
  "courses.title": "课程标题",
  "courses.category": "分类：`tech`（技术）/ `strategy`（战略）/ `compliance`（合规）/ `operations`（运营）",
  "courses.required_level": "适合等级：`C` / `B` / `A`",
  "courses.duration_minutes": "课程时长（分钟）",
  "courses.description": "课程简介",
  "courses.badge": "徽章标识（如「热门」）",
  "courses.rating": "课程评分",
  "courses.learners_count": "学习人数",
  "courses.is_required": "是否必修课",
  "courses.status": "状态：`draft` / `published` / `closed`",
  "courses.price": "课程价格（0 表示免费）",
  "courses.syllabus_url": "课件文件 URL",
  "courses.instructor": "讲师姓名",
  "courses.max_enrollments": "最大报名人数（空表示不限）",

  // ---- enrollments ----
  "enrollments.course_id": "关联课程",
  "enrollments.user_id": "学员用户",
  "enrollments.progress_pct": "学习进度百分比（0–100）",
  "enrollments.completed_at": "完成时间",
  "enrollments.payment_status": "支付状态：`free` / `pending` / `paid` / `refund_pending` / `refunded`",
  "enrollments.payment_order_no": "支付流水号",
  "enrollments.cert_issued": "是否已颁发证书",
  "enrollments.cert_issued_at": "证书颁发时间",

  // ---- learning_resources ----
  "learning_resources.title": "资料标题",
  "learning_resources.file_url": "文件 URL",
  "learning_resources.file_type": "文件类型（如 pdf / video）",
  "learning_resources.file_size": "文件大小（字节）",
  "learning_resources.description": "资料说明",

  // ---- activities ----
  "activities.title": "活动标题",
  "activities.description": "活动介绍",
  "activities.location": "活动地点",
  "activities.start_time": "开始时间",
  "activities.end_time": "结束时间",
  "activities.status": "状态：`draft` / `published` / `closed`",

  // ---- activity_fields ----
  "activity_fields.activity_id": "关联活动",
  "activity_fields.label": "字段标签（如「公司名称」）",
  "activity_fields.field_type": "字段类型：`text` / `select` / `checkbox` 等",
  "activity_fields.is_required": "是否必填",
  "activity_fields.options": "选项列表（select/checkbox 时使用）",

  // ---- registrations ----
  "registrations.activity_id": "关联活动",
  "registrations.name": "报名者姓名",
  "registrations.phone": "联系电话",
  "registrations.email": "邮箱",
  "registrations.organization": "所属单位",
  "registrations.extra_data": "自定义字段的答案",
  "registrations.admin_note": "管理员备注",

  // ---- registration_tags ----
  "registration_tags.registration_id": "关联报名记录",
  "registration_tags.tag": "标签内容",

  // ---- posts ----
  "posts.author_id": "作者",
  "posts.title": "标题",
  "posts.content": "正文（富文本）",
  "posts.tags": "标签列表",
  "posts.likes_count": "点赞数",
  "posts.comments_count": "评论数",
  "posts.views_count": "浏览数",
  "posts.is_featured": "是否精选置顶",

  // ---- post_likes ----
  "post_likes.post_id": "关联帖子",
  "post_likes.user_id": "点赞用户",

  // ---- post_comments ----
  "post_comments.post_id": "关联帖子",
  "post_comments.author_id": "评论者",
  "post_comments.content": "评论内容",

  // ---- announcements ----
  "announcements.title": "标题",
  "announcements.file_url": "附件 URL（可附 PDF 等）",
  "announcements.file_name": "附件文件名",
  "announcements.file_type": "附件 MIME 类型",
  "announcements.is_pinned": "是否置顶",

  // ---- admin_roles ----
  "admin_roles.name": "角色名称",
  "admin_roles.description": "角色说明",
  "admin_roles.permissions": "拥有的权限列表（见下方权限键）",

  // ---- admin_role_assignments ----
  "admin_role_assignments.user_id": "管理员用户 ID（联合主键）",
  "admin_role_assignments.role_id": "角色 ID（联合主键）",

  // ---- sensitive_words ----
  "sensitive_words.word": "敏感词（唯一）",

  // ---- site_settings ----
  "site_settings.key": "配置键（唯一）",
  "site_settings.value": "配置值",

  // ---- system_logs ----
  "system_logs.level": "日志级别：`info` / `warn` / `error`",
  "system_logs.category": "日志分类（如 `payment` / `user` / `demand`）",
  "system_logs.message": "日志内容",
  "system_logs.metadata": "附加结构化数据",
  "system_logs.operator_id": "操作人用户 ID（可为空，系统触发时为空）",
};

// Extra per-table footnotes rendered below the column table
const TABLE_FOOTNOTES: Record<string, string> = {
  demands:
    "**需求状态流转：**\n" +
    "`draft`（草稿）→ `pending_review`（待审核）→ `pending_payment`（待付款）→ `published`（已发布）→ `matched`（已匹配）→ `in_progress`（进行中）→ `pending_acceptance`（待验收）→ `completed`（已完成）  \n" +
    "异常：`closed`（已关闭）/ `refund_pending` / `refunding` / `refunded`（退款流程）",
  notifications:
    "**通知类型：** `bid_received`（收到投标）/ `bid_accepted`（投标被接受）/ `bid_rejected`（投标被拒绝）/ `order_created`（订单创建）/ `delivery_submitted`（提交交付物）/ `delivery_accepted`（交付验收通过）/ `delivery_rejected`（交付被驳回）/ `directed_invite`（定向邀约）/ `system`（系统通知）/ `order_completed`（订单完成）/ `dispute_raised`（发起争议）",
  admin_roles:
    "**可用权限键：** `dashboard`（概览）/ `cockpit`（数据驾驶舱）/ `users`（用户管理）/ `demands`（需求管理）/ `payments`（支付审核）/ `orders`（订单管理）/ `disputes`（争议处理）/ `finance`（财务）/ `ecosystem`（生态）/ `training`（培训）/ `levelcert`（等级认证）/ `content`（内容管理）/ `sensitivewords`（敏感词）/ `activities`（活动）/ `settings`（系统设置）/ `screen`（数据大屏）",
};

// ---------------------------------------------------------------------------
// Parsed representation
// ---------------------------------------------------------------------------
interface ColumnDef {
  colName: string;      // DB column name (snake_case)
  typeSig: string;      // human-readable type string
}

interface TableDef {
  tableName: string;    // DB table name
  columns: ColumnDef[];
  sourceFile: string;
}

// ---------------------------------------------------------------------------
// Parser helpers
// ---------------------------------------------------------------------------

/**
 * Convert a JS type call chain into a human-readable type signature.
 * e.g. "serial("id").primaryKey()" → "serial PK"
 *      "integer("user_id").notNull().references(() => usersTable.id)" → "integer FK→users"
 */
function buildTypeSig(typeExpr: string, allTables: Map<string, string>): string {
  const isPK = typeExpr.includes(".primaryKey()");
  const isUnique = typeExpr.includes(".unique()");

  // FK detection
  let fkTarget = "";
  const refMatch = typeExpr.match(/\.references\s*\(\s*\(\s*\)\s*=>\s*(\w+)\./);
  if (refMatch) {
    const varName = refMatch[1];
    fkTarget = allTables.get(varName) ?? varName.replace(/Table$/, "");
  }

  // Base type
  let base = "unknown";
  if (/^serial\b/.test(typeExpr)) base = "serial";
  else if (/^integer\b/.test(typeExpr) || /^int\b/.test(typeExpr)) base = "integer";
  else if (/^varchar\b/.test(typeExpr)) {
    const lenMatch = typeExpr.match(/length:\s*(\d+)/);
    base = lenMatch ? `varchar(${lenMatch[1]})` : "varchar";
  } else if (/^text\b/.test(typeExpr)) base = "text";
  else if (/^real\b/.test(typeExpr)) base = "real";
  else if (/^boolean\b/.test(typeExpr)) base = "boolean";
  else if (/^timestamp\b/.test(typeExpr)) base = "timestamp";
  else if (/^date\b/.test(typeExpr)) base = "date";
  else if (/^jsonb\b/.test(typeExpr)) {
    const typeAnnotation = typeExpr.match(/\.\$type<([^>]+)>/);
    const inner = typeAnnotation ? typeAnnotation[1].trim() : "";
    if (inner === "string[]" || inner === "number[]") {
      base = `jsonb \`${inner}\``;
    } else {
      base = "jsonb";
    }
  } else if (/^pgEnum\b/.test(typeExpr)) base = "enum";
  // column defined via pgEnum variable: "someEnum("col")"
  else if (/\(\s*"[^"]+"\s*\)/.test(typeExpr) && !typeExpr.startsWith("serial")) {
    base = "enum";
  }

  const parts: string[] = [base];
  if (isPK) parts.push("PK");
  if (fkTarget) parts.push(`FK→${fkTarget}`);
  if (isUnique && !isPK) parts.push("唯一");

  return parts.join(" ");
}

/**
 * Extract all pgTable(...) definitions from a TypeScript source string.
 * Returns a list of { tableName, variableName, bodyText }.
 */
function extractTableBlocks(src: string): Array<{ varName: string; tableName: string; body: string }> {
  const results: Array<{ varName: string; tableName: string; body: string }> = [];

  // Match: export const xyzTable = pgTable("actual_name", {
  const declRe = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*"([^"]+)"\s*,\s*\{/g;

  let m: RegExpExecArray | null;
  while ((m = declRe.exec(src)) !== null) {
    const varName = m[1];
    const tableName = m[2];
    const bodyStart = m.index + m[0].length;

    // Find matching closing brace for the columns object
    let depth = 1;
    let i = bodyStart;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    const body = src.slice(bodyStart, i - 1);
    results.push({ varName, tableName, body });
  }

  return results;
}

/**
 * Parse individual column definitions from a pgTable body string.
 * Returns an array of { colName (DB name), rawTypeExpr }.
 */
function parseColumns(body: string): Array<{ colName: string; rawTypeExpr: string }> {
  const cols: Array<{ colName: string; rawTypeExpr: string }> = [];

  // Split on lines that look like top-level column definitions.
  // Pattern: leading whitespace, JS identifier, colon, then type call.
  const lineRe = /^\s{2,4}(\w+)\s*:\s*([\s\S]+?)(?=,\s*$|\s*\/\/|$)/gm;

  let lm: RegExpExecArray | null;
  while ((lm = lineRe.exec(body)) !== null) {
    const jsKey = lm[1];
    const rawExpr = lm[2].trim();

    // Skip helper properties that aren't column definitions
    if (jsKey === "primaryKey" || jsKey === "unique" || jsKey === "uniqueIndex") continue;
    // Must start with a type function call
    if (!/^(serial|integer|varchar|text|real|boolean|timestamp|date|jsonb|pgEnum|primaryKey|\w+Enum)\s*\(/.test(rawExpr)) continue;

    // Extract the DB column name from the first string arg of the type call
    const colNameMatch = rawExpr.match(/\(\s*"([^"]+)"/);
    if (!colNameMatch) continue;

    cols.push({ colName: colNameMatch[1], rawTypeExpr: rawExpr });
  }

  return cols;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run() {
  const files = readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .map((f) => join(SCHEMA_DIR, f));

  // First pass: collect varName → tableName mapping (needed for FK resolution)
  const varToTable = new Map<string, string>();
  const sources: Array<{ file: string; src: string }> = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    sources.push({ file, src });
    const blocks = extractTableBlocks(src);
    for (const b of blocks) varToTable.set(b.varName, b.tableName);
  }

  // Second pass: parse all table definitions
  const allTables: TableDef[] = [];
  for (const { file, src } of sources) {
    const blocks = extractTableBlocks(src);
    for (const { varName, tableName, body } of blocks) {
      const rawCols = parseColumns(body);
      const columns: ColumnDef[] = rawCols.map(({ colName, rawTypeExpr }) => ({
        colName,
        typeSig: buildTypeSig(rawTypeExpr, varToTable),
      }));
      allTables.push({ tableName, columns, sourceFile: file });
    }
  }

  // Build a lookup map
  const tableMap = new Map<string, TableDef>();
  for (const t of allTables) tableMap.set(t.tableName, t);

  // Determine total table count
  const totalTables = allTables.length;

  // Helper: get Chinese description for a field
  function fieldDesc(tableName: string, colName: string): string {
    return (
      FIELD_META[`${tableName}.${colName}`] ??
      FIELD_META[`*.${colName}`] ??
      colName
    );
  }

  // Helper: render one table section. Returns empty string if the table no
  // longer exists in the schema (e.g. after it has been deleted), so that the
  // module list stays strictly in sync with the actual schema files.
  function renderTable(tableName: string): string {
    const def = tableMap.get(tableName);
    if (!def) return "";

    const meta = TABLE_META[tableName];
    const displayName = meta?.zh ?? tableName;
    const desc = meta?.desc ?? "";

    const lines: string[] = [];
    lines.push(`### \`${tableName}\` — ${displayName}`);
    lines.push("");
    if (desc) {
      lines.push(desc);
      lines.push("");
    }
    lines.push("| 字段 | 类型 | 说明 |");
    lines.push("|---|---|---|");

    for (const col of def.columns) {
      const zh = fieldDesc(tableName, col.colName);
      lines.push(`| \`${col.colName}\` | ${col.typeSig} | ${zh} |`);
    }

    const footnote = TABLE_FOOTNOTES[tableName];
    if (footnote) {
      lines.push("");
      lines.push(footnote);
    }

    lines.push("");
    lines.push("---");
    lines.push("");
    return lines.join("\n");
  }

  // Assemble document
  const parts: string[] = [];
  parts.push(`# 接单吧 数据库表结构说明`);
  parts.push("");
  parts.push(`> 共 **${totalTables} 张表**，按业务模块分组。`);
  parts.push("");
  parts.push("---");
  parts.push("");

  const renderedTables = new Set<string>();

  for (const mod of MODULES) {
    // Only emit tables that actually exist in the current schema
    const existingTables = mod.tables.filter((tbl) => tableMap.has(tbl));
    if (existingTables.length === 0) continue;

    parts.push(`## ${mod.title}`);
    parts.push("");
    for (const tbl of existingTables) {
      parts.push(renderTable(tbl));
      renderedTables.add(tbl);
    }
  }

  // Append any tables not listed in any module
  const extras = allTables.filter((t) => !renderedTables.has(t.tableName));
  if (extras.length > 0) {
    parts.push("## 其他");
    parts.push("");
    for (const t of extras) {
      parts.push(renderTable(t.tableName));
    }
  }

  const output = parts.join("\n");
  writeFileSync(OUTPUT_FILE, output, "utf8");
  console.log(`✓ 已生成 ${OUTPUT_FILE}（共 ${totalTables} 张表）`);
}

run();
