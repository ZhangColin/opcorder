import { db } from "@workspace/db";
import { demoProjectsTable, demoProjectVersionsTable, agentConfigsTable } from "@workspace/db";
import { v2ClientDemandsTable, v2ClientDemandVersionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { callLLM, type LLMMessage, type LLMTool } from "./llm";
import { getSkillsForTask } from "./skillRegistry";
import { logger } from "./logger";
import * as vm from "vm";

/* ─── Default system prompt (fallback if DB not configured) ─── */

const DEMO_AGENT_DEFAULT_PROMPT = `你是一位资深前端工程师。你的任务是根据产品 UI 方案和客户需求，生成一个完整可运行的前端演示原型。

## 工作方式

通过工具函数逐文件编写代码，三个文件都写完后调用 finish：
- write_file("index.html", 内容) — 写 HTML 主文件
- write_file("style.css", 内容) — 写样式文件
- write_file("app.js", 内容) — 写交互逻辑
- finish() — 确认所有文件写完

## 技术要求

1. 纯 HTML + CSS + JavaScript（不用 React、不用 TypeScript、不用任何构建工具）
2. index.html 的 <head> 里必须引入 Tailwind CDN：
   <script src="https://cdn.tailwindcss.com"></script>
3. index.html 里**不要**写 <link href="style.css"> 或 <script src="app.js">，这两个文件会被平台自动内联，写了会 404
4. app.js 用原生 DOM API，不用 import/export，不用 ES module
5. app.js 里所有 DOM 操作必须包在 document.addEventListener('DOMContentLoaded', function() { ... }) 里
6. 访问 DOM 元素前必须做 null 检查：const el = document.getElementById('x'); if (el) { el.style.display = '...'; }

## 内容要求

- 与产品 UI 方案高度匹配，体现核心业务流程
- 至少 2 个可切换的页面/视图（Tab 切换、步骤、模态框等）
- 填充真实示例数据：真实姓名、公司名、金额、日期
- 界面专业美观，充分利用 Tailwind 实现现代 UI 风格（圆角、阴影、配色）

<!-- prompt-version: 1.3 -->`;

/* ─── Tool definitions for the coding agent ─── */

const CODING_TOOLS: LLMTool[] = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "写入一个 Demo 文件的完整内容。每次调用只写一个文件。",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            enum: ["index.html", "style.css", "app.js"],
            description: "文件名，只能是这三个之一",
          },
          content: {
            type: "string",
            description: "文件的完整内容",
          },
        },
        required: ["filename", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finish",
      description: "所有文件写完后调用，表示 Demo 代码已完成。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

/* ─── Validate generated files ─── */

function validateFiles(files: Record<string, string>): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  const missing = ["index.html", "style.css", "app.js"].filter((f) => !files[f]?.trim());
  if (missing.length > 0) {
    errors.push(`缺少文件：${missing.join(", ")}，请用 write_file 补全`);
    return { ok: false, errors };
  }

  // JS syntax check via Node vm (parse only, no execution)
  try {
    new vm.Script(files["app.js"]);
  } catch (e: any) {
    errors.push(`app.js 语法错误：${e.message}`);
  }

  // HTML basic structure check
  const html = files["index.html"];
  if (!html.includes("<body") || !html.includes("</body>")) {
    errors.push("index.html 缺少 <body> 标签");
  }
  // Note: do NOT check for app.js reference — prompt tells model not to write it
  // (platform inlines the file automatically; external src would 404 in srcdoc)
  if (!html.includes("tailwindcss.com") && !html.includes("tailwind")) {
    errors.push("index.html 未引入 Tailwind CDN");
  }

  return { ok: errors.length === 0, errors };
}

/* ─── Planning pass: think about the product before writing code ─── */

async function planDemo(demandInfo: string): Promise<string> {
  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `你是一位产品设计师。根据客户需求信息，设计一个前端演示原型的 UI 方案。
只输出文字描述，不要写任何代码。

描述内容：
1. 产品定位：这是什么产品，解决什么问题，目标用户是谁
2. Demo 页面/版块清单（至少 2 个）：每个页面的名称和主要功能
3. 核心数据：关键字段名称和示例值（用真实人名、公司名、金额、日期）
4. 交互逻辑：Tab 切换、表单、列表筛选等主要交互方式`,
    },
    {
      role: "user",
      content: `客户需求信息：\n${demandInfo}\n\n请输出 UI 方案（仅文字描述，不写代码）：`,
    },
  ];

  try {
    const response = await callLLM(messages);
    return response.content ?? "";
  } catch (err) {
    logger.warn({ err }, "demoAgent: planning pass failed, proceeding without plan");
    return "";
  }
}

/* ─── Coding agent loop ─── */

async function runCodingAgent(
  systemPrompt: string,
  demandInfo: string,
  uiPlan: string,
  existingFiles?: Record<string, string>,
  feedback?: string
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const MAX_ROUNDS = 3;

  let userContent = `客户需求信息：\n${demandInfo}`;
  if (uiPlan) userContent += `\n\nUI 方案（请严格按此生成）：\n${uiPlan}`;
  if (existingFiles && Object.keys(existingFiles).length > 0) {
    userContent += `\n\n当前版本文件（请在此基础上修改）：\n`;
    for (const [name, content] of Object.entries(existingFiles)) {
      userContent += `\n--- ${name} ---\n${content}\n`;
    }
  }
  if (feedback) userContent += `\n\n用户修改意见：${feedback}`;
  userContent += `\n\n请逐个调用 write_file 写入三个文件，全部写完后调用 finish。`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    logger.info({ round, filesSoFar: Object.keys(files) }, "demoAgent: coding round start");

    const response = await callLLM(messages, CODING_TOOLS);

    const toolCalls = response.toolCalls ?? [];
    let calledFinish = false;

    for (const tc of toolCalls) {
      try {
        if (tc.function.name === "write_file") {
          const args = JSON.parse(tc.function.arguments) as { filename: string; content: string };
          if (args.filename && args.content) {
            files[args.filename] = args.content;
            logger.info({ filename: args.filename, len: args.content.length, round }, "demoAgent: file written");
          }
        } else if (tc.function.name === "finish") {
          calledFinish = true;
        }
      } catch (parseErr) {
        logger.warn({ parseErr, tc }, "demoAgent: failed to parse tool call args");
      }
    }

    // Add assistant turn + tool results to conversation history
    messages.push({
      role: "assistant",
      content: response.content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    });
    for (const tc of toolCalls) {
      messages.push({
        role: "tool",
        content: tc.function.name === "write_file" ? "已写入" : "已完成",
        tool_call_id: tc.id,
        name: tc.function.name,
      });
    }

    // No tool calls at all — nudge the model
    if (toolCalls.length === 0) {
      if (round < MAX_ROUNDS - 1) {
        messages.push({
          role: "user",
          content: "请使用 write_file 工具写入 index.html、style.css、app.js 三个文件，写完后调用 finish。",
        });
        continue;
      }
      break;
    }

    if (calledFinish || round === MAX_ROUNDS - 1) {
      const { ok, errors } = validateFiles(files);
      if (ok) {
        logger.info({ round }, "demoAgent: validation passed");
        break;
      }
      if (round < MAX_ROUNDS - 1) {
        logger.info({ errors, round }, "demoAgent: validation failed, sending feedback");
        messages.push({
          role: "user",
          content: `文件验证发现以下问题，请修复后重新调用 write_file 覆盖对应文件，然后调用 finish：\n${errors.map((e) => `❌ ${e}`).join("\n")}`,
        });
      }
    }
  }

  return files;
}

/* ─── JS safety review: fix null DOM-reference patterns ─── */

/**
 * Static heuristic: does app.js directly chain property access on a DOM getter
 * without optional chaining or a prior null-guard variable assignment?
 * Matches patterns like: getElementById('x').style  querySelector('.y').classList
 * Safe patterns (getElementById('x')?.style  or  const el = ...; if (el)) are excluded.
 */
function hasRiskyDomAccess(js: string): boolean {
  // Look for direct .property access immediately after a DOM getter call (no ?. before .)
  return /(?:getElementById|querySelector(?!All))\s*\([^)]+\)\.[a-zA-Z]/.test(js);
}

async function safetyReviewJs(
  systemPrompt: string,
  files: Record<string, string>
): Promise<Record<string, string>> {
  const js = files["app.js"];
  if (!js?.trim()) return files;
  if (!hasRiskyDomAccess(js)) {
    logger.info("demoAgent: JS safety check passed (no risky patterns detected)");
    return files;
  }

  logger.info("demoAgent: risky DOM access patterns found, running safety review");

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `以下是生成的 app.js，请检查其中所有通过 getElementById / querySelector 获取 DOM 元素后直接访问属性的地方（例如 \`getElementById('x').style.display\`），确保每处都有 null 检查。

修复规则：
- 如果直接链式访问，改为先赋值再检查：
  \`const el = document.getElementById('x'); if (el) { el.style.display = 'block'; }\`
- 或使用可选链：\`document.getElementById('x')?.style\`（仅适合简单赋值，不适合读取值）
- 其他代码保持不变

---
当前 app.js：
\`\`\`js
${js}
\`\`\`

如有需要修改，调用 write_file("app.js", 修复后完整内容) 写入修复版本，然后调用 finish()。
如果代码已经是安全的，直接调用 finish() 即可。`,
    },
  ];

  const MAX_REVIEW_ROUNDS = 2;
  for (let round = 0; round < MAX_REVIEW_ROUNDS; round++) {
    const response = await callLLM(messages, CODING_TOOLS);
    const toolCalls = response.toolCalls ?? [];
    let calledFinish = false;
    let updatedJs = false;

    for (const tc of toolCalls) {
      try {
        if (tc.function.name === "write_file") {
          const args = JSON.parse(tc.function.arguments) as { filename: string; content: string };
          if (args.filename === "app.js" && args.content) {
            // Validate syntax before accepting
            try {
              new vm.Script(args.content);
              files["app.js"] = args.content;
              updatedJs = true;
              logger.info({ len: args.content.length }, "demoAgent: safety review fixed app.js");
            } catch (syntaxErr: any) {
              logger.warn({ syntaxErr: syntaxErr.message }, "demoAgent: safety review produced invalid JS, keeping original");
            }
          }
        } else if (tc.function.name === "finish") {
          calledFinish = true;
        }
      } catch (parseErr) {
        logger.warn({ parseErr }, "demoAgent: safety review tool parse error");
      }
    }

    if (calledFinish || toolCalls.length === 0) break;

    if (!calledFinish && updatedJs && round < MAX_REVIEW_ROUNDS - 1) {
      messages.push({ role: "assistant", content: response.content, tool_calls: toolCalls });
      for (const tc of toolCalls) {
        messages.push({ role: "tool", content: "已写入", tool_call_id: tc.id, name: tc.function.name });
      }
      messages.push({ role: "user", content: "已更新。请调用 finish() 完成审查。" });
    } else {
      break;
    }
  }

  return files;
}

/* ─── Classify Demo feedback (unchanged) ─── */

export async function classifyDemoFeedback(
  feedback: string
): Promise<{ valid: boolean; hint: string }> {
  try {
    const response = await callLLM([
      {
        role: "system",
        content: `你是一个 Demo 修改意见分类器。
判断用户提交的修改意见是否为针对已生成的 Demo 前端页面的有效修改请求。

有效意见包括：颜色、布局、字体、文字内容、组件样式、交互动效、图片/图标等页面视觉或交互的具体要求。
无效意见包括：修改需求本身、与页面展示无关的内容、无实质意义的语句、攻击性内容。

请只输出严格的 JSON，格式：{"valid": true/false, "hint": "如果无效，给用户的一句友好提示；有效时返回空字符串"}`,
      },
      {
        role: "user",
        content: `修改意见：${feedback}`,
      },
    ]);

    const raw = response.content?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      valid: Boolean(parsed.valid),
      hint: typeof parsed.hint === "string" ? parsed.hint : "",
    };
  } catch (err) {
    logger.warn({ err, feedback }, "classifyDemoFeedback failed, defaulting to valid");
    return { valid: true, hint: "" };
  }
}

/* ─── Main: generateDemo ─── */

export async function generateDemo(demandId: number, feedback?: string): Promise<void> {
  logger.info({ demandId, hasFeedback: !!feedback }, "generateDemo: starting");

  const [demand] = await db
    .select()
    .from(v2ClientDemandsTable)
    .where(eq(v2ClientDemandsTable.id, demandId))
    .limit(1);

  if (!demand) {
    logger.error({ demandId }, "generateDemo: demand not found");
    return;
  }

  const [latestVersion] = await db
    .select()
    .from(v2ClientDemandVersionsTable)
    .where(eq(v2ClientDemandVersionsTable.demandId, demandId))
    .orderBy(desc(v2ClientDemandVersionsTable.versionNo))
    .limit(1);

  const [existing] = await db
    .select()
    .from(demoProjectsTable)
    .where(eq(demoProjectsTable.demandId, demandId))
    .limit(1);

  const nextVersion = existing ? existing.version + 1 : 1;
  const newStatus = feedback ? "updating" : "generating";

  if (!existing) {
    await db.insert(demoProjectsTable).values({
      demandId,
      status: "generating",
      version: 1,
      files: null,
      entryFile: "index.html",
      dependencies: {},
      revisionLog: [],
    });
  } else {
    await db
      .update(demoProjectsTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(demoProjectsTable.demandId, demandId));
  }

  try {
    const skillContext = await getSkillsForTask("demo_generation");

    const demandInfo = [
      `需求标题：${demand.title}`,
      `需求类型：${demand.demandType ?? "未指定"}`,
      `预算：${demand.budgetMin ?? "?"}~${demand.budgetMax ?? "?"} 元`,
      `期望交付时间：${demand.hopeDeliveryDate ?? "未指定"}`,
      latestVersion?.detail ? `需求详情：\n${latestVersion.detail}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Load system prompt from DB config
    const [agentCfg] = await db
      .select({ systemPrompt: agentConfigsTable.systemPrompt, isEnabled: agentConfigsTable.isEnabled })
      .from(agentConfigsTable)
      .where(eq(agentConfigsTable.sceneKey, "demo_generation"))
      .limit(1);

    const basePrompt = agentCfg?.systemPrompt ?? DEMO_AGENT_DEFAULT_PROMPT;
    const systemPrompt = [skillContext, basePrompt].filter(Boolean).join("\n\n");

    // Pass 1: Plan the UI before writing code
    logger.info({ demandId }, "generateDemo: starting planning pass");
    const uiPlan = await planDemo(demandInfo);
    logger.info({ demandId, planLength: uiPlan.length }, "generateDemo: planning complete");

    // Pass 2: Coding agent loop (write_file tools + validation)
    const existingFiles = feedback && existing?.files
      ? (existing.files as Record<string, string>)
      : undefined;

    let files = await runCodingAgent(systemPrompt, demandInfo, uiPlan, existingFiles, feedback);

    const { ok, errors } = validateFiles(files);
    if (!ok) {
      logger.warn({ demandId, errors }, "generateDemo: final validation still has issues, saving anyway");
    }

    // Pass 3: JS safety review — fix null DOM-reference patterns before saving
    files = await safetyReviewJs(systemPrompt, files);

    const [updated] = await db
      .update(demoProjectsTable)
      .set({
        status: "ready",
        version: nextVersion,
        files,
        entryFile: "index.html",
        dependencies: {},
        skillSnapshot: skillContext || null,
        updatedAt: new Date(),
      })
      .where(eq(demoProjectsTable.demandId, demandId))
      .returning();

    if (updated && feedback) {
      const currentLog = (updated.revisionLog ?? []) as Array<{
        version: number;
        feedback: string;
        valid: boolean;
        timestamp: string;
      }>;
      await db
        .update(demoProjectsTable)
        .set({
          revisionLog: [
            ...currentLog,
            { version: nextVersion, feedback, valid: true, timestamp: new Date().toISOString() },
          ],
        })
        .where(eq(demoProjectsTable.demandId, demandId));
    }

    const [demoRecord] = await db
      .select({ id: demoProjectsTable.id })
      .from(demoProjectsTable)
      .where(eq(demoProjectsTable.demandId, demandId))
      .limit(1);

    if (demoRecord) {
      await db.insert(demoProjectVersionsTable).values({
        demoProjectId: demoRecord.id,
        version: nextVersion,
        files,
        dependencies: {},
      });
    }

    logger.info({ demandId, version: nextVersion, filesWritten: Object.keys(files) }, "generateDemo: completed");
  } catch (err) {
    logger.error({ err, demandId }, "generateDemo: failed");
    await db
      .update(demoProjectsTable)
      .set({
        status: "error",
        errorMsg: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(demoProjectsTable.demandId, demandId));
  }
}
