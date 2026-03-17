ALTER TABLE "compras"
ADD COLUMN "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;

UPDATE "compras"
SET "created_at" = COALESCE("created_at", "fecha_compra");
