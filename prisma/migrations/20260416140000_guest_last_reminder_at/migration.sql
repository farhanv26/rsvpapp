-- Optional: when a follow-up / reminder was last sent (email, WhatsApp, or recorded manually).
ALTER TABLE "Guest" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
