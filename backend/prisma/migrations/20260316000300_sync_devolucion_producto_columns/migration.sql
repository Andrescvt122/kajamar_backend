ALTER TABLE "devolucion_producto"
ADD COLUMN IF NOT EXISTS "id_compras" INTEGER,
ADD COLUMN IF NOT EXISTS "estado" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "tipo_devolucion" VARCHAR(20) DEFAULT 'reemplazo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_compra'
      AND conrelid = 'devolucion_producto'::regclass
  ) THEN
    ALTER TABLE "devolucion_producto"
    ADD CONSTRAINT "fk_compra"
    FOREIGN KEY ("id_compras") REFERENCES "compras"("id_compra")
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;
  END IF;
END $$;
