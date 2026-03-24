DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "detalle_productos"
    GROUP BY "codigo_barras_producto_compra"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No se puede crear la restricción única de detalle_productos.codigo_barras_producto_compra porque ya existen códigos duplicados.';
  END IF;
END $$;

CREATE UNIQUE INDEX "uq_detalle_productos_codigo_barras_producto_compra"
ON "detalle_productos"("codigo_barras_producto_compra");
