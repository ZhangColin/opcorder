import { db } from "@workspace/db";
import { skillsTable, agentTaskSkillLinksTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { logger } from "./logger";

/** Known task types in this system. Extend as new agent scenes are added. */
export const KNOWN_TASK_TYPES: Array<{ taskType: string; label: string }> = [
  { taskType: "demo_generation",     label: "Demo 生成" },
  { taskType: "demand_analysis",     label: "需求分析" },
  { taskType: "requirement_analysis", label: "需求文档生成" },
  { taskType: "v2_demand_analysis",  label: "V2 需求分析" },
  { taskType: "v2_outsource_split",  label: "外包需求拆解" },
  { taskType: "v2_admin_opc_demand", label: "运营创建 OPC 需求" },
  { taskType: "v2_admin_opc_milestone", label: "里程碑配置" },
];

/**
 * Retrieve and assemble all active skills for a given task type, sorted by sort_order.
 * Returns a structured text block ready to be prepended to an agent system prompt.
 * Returns empty string if no skills are configured for this task type.
 */
export async function getSkillsForTask(taskType: string): Promise<string> {
  try {
    const links = await db
      .select({
        sortOrder: agentTaskSkillLinksTable.sortOrder,
        name: skillsTable.name,
        skillMd: skillsTable.skillMd,
        refFiles: skillsTable.refFiles,
        isActive: skillsTable.isActive,
      })
      .from(agentTaskSkillLinksTable)
      .innerJoin(skillsTable, eq(agentTaskSkillLinksTable.skillId, skillsTable.id))
      .where(
        and(
          eq(agentTaskSkillLinksTable.taskType, taskType),
          eq(skillsTable.isActive, true)
        )
      )
      .orderBy(asc(agentTaskSkillLinksTable.sortOrder));

    if (links.length === 0) return "";

    const parts: string[] = [];
    for (const link of links) {
      parts.push(`## Skill: ${link.name}\n\n${link.skillMd}`);
      const refs = (link.refFiles ?? {}) as Record<string, string>;
      for (const [filename, content] of Object.entries(refs)) {
        parts.push(`### Reference: ${filename}\n\n${content}`);
      }
    }

    return `# Injected Skills\n\n${parts.join("\n\n---\n\n")}`;
  } catch (err) {
    logger.error({ err, taskType }, "getSkillsForTask failed — returning empty string");
    return "";
  }
}
