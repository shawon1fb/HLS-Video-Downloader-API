import {
  pgTable,
  varchar,
  timestamp,
  integer,
  uuid,
  text,
} from 'drizzle-orm/pg-core';

export enum DownloadStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum DownloadFormat {
  MP4 = 'mp4',
  HLS = 'hls',
}

export const downloads = pgTable('downloads', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  status: varchar('status', { length: 20 })
    .notNull()
    .default(DownloadStatus.PENDING),
  format: varchar('format', { length: 10 }).notNull(), // mp4 or hls
  filePath: text('file_path'),
  fileName: text('file_name'),
  progress: integer('progress').default(0),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Download = typeof downloads.$inferSelect;
export type NewDownload = typeof downloads.$inferInsert;
