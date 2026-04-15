import { pgTable, serial, integer, text, varchar, timestamp, pgEnum, real, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const courseCategoryEnum = pgEnum("course_category", ["tech", "strategy", "compliance", "operations"]);
export const courseLevelEnum = pgEnum("course_level", ["C", "B", "A"]);
export const courseStatusEnum = pgEnum("course_status", ["draft", "published", "closed"]);
export const paymentStatusEnum = pgEnum("payment_status", ["free", "pending", "paid", "refund_pending", "refunded"]);

export const coursesTable = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  category: courseCategoryEnum("category").notNull().default("tech"),
  requiredLevel: courseLevelEnum("required_level").notNull().default("C"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  description: text("description").notNull().default(""),
  badge: varchar("badge", { length: 50 }),
  rating: real("rating"),
  learnersCount: integer("learners_count").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(false),
  status: courseStatusEnum("status").notNull().default("draft"),
  price: real("price").notNull().default(0),
  syllabusUrl: text("syllabus_url"),
  instructor: varchar("instructor", { length: 100 }),
  maxEnrollments: integer("max_enrollments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const enrollmentsTable = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  progressPct: integer("progress_pct").notNull().default(0),
  completedAt: timestamp("completed_at"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("free"),
  paymentOrderNo: varchar("payment_order_no", { length: 100 }),
  certIssued: boolean("cert_issued").notNull().default(false),
  certIssuedAt: timestamp("cert_issued_at"),
  refundReason: text("refund_reason"),
  refundRequestedAt: timestamp("refund_requested_at"),
  refundOrderNo: varchar("refund_order_no", { length: 100 }),
  refundedAt: timestamp("refunded_at"),
  refundRejectReason: text("refund_reject_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const learningResourcesTable = pgTable("learning_resources", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull().default("file"),
  fileSize: integer("file_size"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEnrollmentSchema = createInsertSchema(enrollmentsTable).omit({ id: true, createdAt: true, completedAt: true, certIssuedAt: true });
export const insertCourseSchema = createInsertSchema(coursesTable).omit({ id: true, createdAt: true, updatedAt: true, learnersCount: true });

export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof coursesTable.$inferSelect;
export type Enrollment = typeof enrollmentsTable.$inferSelect;
export type LearningResource = typeof learningResourcesTable.$inferSelect;
