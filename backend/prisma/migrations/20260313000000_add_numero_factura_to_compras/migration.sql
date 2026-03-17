ALTER TABLE "compras"
ADD COLUMN "numero_factura" VARCHAR(50);

CREATE UNIQUE INDEX "uq_compras_numero_factura"
ON "compras"("numero_factura");
