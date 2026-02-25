CREATE TABLE "downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"format" varchar(10) NOT NULL,
	"file_path" text,
	"file_name" text,
	"progress" integer DEFAULT 0,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
