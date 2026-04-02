ALTER TABLE "devolucion_cliente"
ADD COLUMN "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;

UPDATE "devolucion_cliente"
SET "created_at" = COALESCE("fecha_devolucion"::timestamp, CURRENT_TIMESTAMP)
WHERE "created_at" IS NULL;

ALTER TABLE "productos_baja"
ADD COLUMN "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;

UPDATE "productos_baja"
SET "created_at" = COALESCE("fecha_baja"::timestamp, CURRENT_TIMESTAMP)
WHERE "created_at" IS NULL;
