-- Optional WhatsApp notification template on RewardProgram.
-- Supports {name}, {earned}, {balance} placeholders. NULL = no prompt shown.

ALTER TABLE "RewardProgram"
  ADD COLUMN "whatsappMessage" TEXT;
