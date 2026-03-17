ALTER TABLE "devolucion_producto"
ADD COLUMN "comprobante_url" VARCHAR(255),
ADD COLUMN "comprobante_nombre" VARCHAR(255),
ADD COLUMN "comprobante_mime" VARCHAR(100),
ADD COLUMN "comprobante_size" INTEGER;
