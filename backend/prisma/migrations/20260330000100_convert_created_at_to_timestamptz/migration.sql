ALTER TABLE "compras"
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6)
USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "devolucion_cliente"
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6)
USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "devolucion_producto"
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6)
USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "productos_baja"
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6)
USING "created_at" AT TIME ZONE 'UTC';
