-- Add verification fields to users and create OTP challenge storage.

CREATE TYPE "OtpChannel" AS ENUM ('EMAIL', 'PHONE');

ALTER TABLE "users"
ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "phone_verified" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "verification_session_id" TEXT NOT NULL,
    "channel" "OtpChannel" NOT NULL,
    "target" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),
    "invalidated_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resend_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "otp_codes_verification_session_id_key" ON "otp_codes"("verification_session_id");
CREATE INDEX "otp_codes_user_id_channel_created_at_idx" ON "otp_codes"("user_id", "channel", "created_at");
CREATE INDEX "otp_codes_target_channel_created_at_idx" ON "otp_codes"("target", "channel", "created_at");
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

ALTER TABLE "otp_codes"
ADD CONSTRAINT "otp_codes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
