DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'FraudRiskLevel'
  ) THEN
    CREATE TYPE "FraudRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
  END IF;
END $$;

ALTER TABLE "orders"
ALTER COLUMN "risk_level" DROP DEFAULT,
ALTER COLUMN "risk_level" TYPE "FraudRiskLevel" USING ("risk_level"::"FraudRiskLevel"),
ALTER COLUMN "risk_level" SET DEFAULT 'LOW';
