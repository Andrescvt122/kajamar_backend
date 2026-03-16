ALTER TABLE "devolucion_producto"
ADD COLUMN "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;

UPDATE "devolucion_producto"
SET "created_at" = COALESCE("created_at", "fecha_devolucion"::timestamp, CURRENT_TIMESTAMP);
