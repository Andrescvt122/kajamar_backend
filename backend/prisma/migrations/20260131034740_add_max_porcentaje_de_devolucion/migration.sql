-- CreateTable
CREATE TABLE "acceso" (
    "acceso_id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "estado_usuario" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acceso_pkey" PRIMARY KEY ("acceso_id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id_categoria" SERIAL NOT NULL,
    "nombre_categoria" VARCHAR(80) NOT NULL,
    "descripcion_categoria" VARCHAR(80),
    "estado" BOOLEAN NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id_cliente" SERIAL NOT NULL,
    "nombre_cliente" VARCHAR(100) NOT NULL,
    "tipo_docume" VARCHAR(20) NOT NULL,
    "numero_doc" VARCHAR(30) NOT NULL,
    "correo_cliente" VARCHAR(100),
    "telefono_cliente" VARCHAR(20),
    "estado_cliente" VARCHAR(10) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "compras" (
    "id_compra" SERIAL NOT NULL,
    "fecha_compra" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_proveedor" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "estado_compra" VARCHAR(25),

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id_compra")
);

-- CreateTable
CREATE TABLE "detalle_compra" (
    "id_detalle" SERIAL NOT NULL,
    "id_compra" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2),
    "id_detalle_producto" INTEGER,
    "iva_aplicado" DECIMAL,
    "icu_aplicado" DECIMAL,

    CONSTRAINT "detalle_compra_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateTable
CREATE TABLE "detalle_devolucion_producto" (
    "id_detalle_devolucion_productos" SERIAL NOT NULL,
    "id_devolucion_producto" INTEGER,
    "id_detalle_producto" INTEGER,
    "motivo" VARCHAR(50),
    "cantidad_devuelta" INTEGER,
    "es_descuento" BOOLEAN,
    "nombre_producto" VARCHAR(50),

    CONSTRAINT "detalle_devolucion_producto_pkey" PRIMARY KEY ("id_detalle_devolucion_productos")
);

-- CreateTable
CREATE TABLE "detalle_productos" (
    "id_detalle_producto" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "codigo_barras_producto_compra" VARCHAR(50) NOT NULL,
    "fecha_vencimiento" DATE,
    "stock_producto" INTEGER NOT NULL,
    "es_devolucion" BOOLEAN DEFAULT false,
    "estado" BOOLEAN,

    CONSTRAINT "detalle_productos_pkey" PRIMARY KEY ("id_detalle_producto")
);

-- CreateTable
CREATE TABLE "detalle_venta" (
    "id_detalle" SERIAL NOT NULL,
    "id_venta" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2),
    "id_detalle_producto" INTEGER,
    "iva_venta" DECIMAL,
    "icu_venta" DECIMAL,

    CONSTRAINT "detalle_venta_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateTable
CREATE TABLE "devolucion_cliente" (
    "id_devoluciones_cliente" SERIAL NOT NULL,
    "id_venta" INTEGER,
    "id_responsable" INTEGER,
    "fecha_devolucion" DATE,
    "total_devolucion" DECIMAL,
    "tipo" VARCHAR(50),
    "fecha_cambio_estado_devolucion_proveedor" DATE,
    "nombre_responsable" VARCHAR(20),
    "nombre_cliente" VARCHAR(20),

    CONSTRAINT "devolucion_cliente_pkey" PRIMARY KEY ("id_devoluciones_cliente")
);

-- CreateTable
CREATE TABLE "devolucion_producto" (
    "id_devolucion_product" SERIAL NOT NULL,
    "id_responsable" INTEGER,
    "fecha_devolucion" DATE,
    "cantidad_total" INTEGER,
    "nombre_responsable" VARCHAR(20),
    "numero_factura" VARCHAR(20),

    CONSTRAINT "devolucion_producto_pkey" PRIMARY KEY ("id_devolucion_product")
);

-- CreateTable
CREATE TABLE "impuestos_productos" (
    "id_impuesto" SERIAL NOT NULL,
    "nombre_impuesto" VARCHAR(30) NOT NULL,
    "valor_impuesto" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "impuestos_productos_pkey" PRIMARY KEY ("id_impuesto")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" SERIAL NOT NULL,
    "acceso_id" INTEGER NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "permiso_id" SERIAL NOT NULL,
    "modulo" VARCHAR(50) NOT NULL,
    "permiso_nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("permiso_id")
);

-- CreateTable
CREATE TABLE "producto_proveedor" (
    "id_producto_proveedor" SERIAL NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "estado_producto_proveedor" BOOLEAN NOT NULL,

    CONSTRAINT "producto_proveedor_pkey" PRIMARY KEY ("id_producto_proveedor")
);

-- CreateTable
CREATE TABLE "productos" (
    "id_producto" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(100),
    "stock_actual" INTEGER NOT NULL,
    "stock_minimo" INTEGER NOT NULL,
    "stock_maximo" INTEGER NOT NULL,
    "estado" BOOLEAN NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "iva" INTEGER,
    "icu" INTEGER,
    "porcentaje_incremento" INTEGER,
    "costo_unitario" INTEGER NOT NULL,
    "precio_venta" INTEGER NOT NULL,
    "url_imagen" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "cantidad_unitaria" INTEGER,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "productos_baja" (
    "id_baja_productos" SERIAL NOT NULL,
    "id_responsable" INTEGER,
    "fecha_baja" DATE,
    "cantida_baja" INTEGER,
    "total_precio_baja" DECIMAL,
    "nombre_responsable" VARCHAR(50),

    CONSTRAINT "productos_baja_pkey" PRIMARY KEY ("id_baja_productos")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id_proveedor" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(15),
    "direccion" VARCHAR(250),
    "estado" BOOLEAN NOT NULL,
    "descripcion" VARCHAR(225),
    "nit" TEXT,
    "tipo_persona" VARCHAR(50),
    "contacto" VARCHAR(100),
    "correo" VARCHAR(120),

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id_proveedor")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "rol_id" INTEGER NOT NULL,
    "permiso_id" INTEGER NOT NULL,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "rol_id" SERIAL NOT NULL,
    "rol_nombre" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(255),
    "estado_rol" BOOLEAN DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("rol_id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "usuario_id" SERIAL NOT NULL,
    "acceso_id" INTEGER NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "apellido" VARCHAR(50),
    "telefono" VARCHAR(20),
    "documento" VARCHAR(50),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id_venta" SERIAL NOT NULL,
    "fecha_venta" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_cliente" INTEGER,
    "metodo_pago" VARCHAR(20) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "estado_venta" VARCHAR(20) DEFAULT 'Completada',

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id_venta")
);

-- CreateTable
CREATE TABLE "detalle_productos_baja" (
    "id_detalle_productos_baja" SERIAL NOT NULL,
    "id_baja_productos" INTEGER,
    "id_detalle_productos" INTEGER,
    "cantidad" INTEGER,
    "motivo" VARCHAR(50),
    "total_producto_baja" DECIMAL(10,2),
    "nombre_producto" VARCHAR(50),

    CONSTRAINT "detalle_productos_baja_pkey" PRIMARY KEY ("id_detalle_productos_baja")
);

-- CreateTable
CREATE TABLE "proveedor_categoria" (
    "id_proveedor_categoria" SERIAL NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedor_categoria_pkey" PRIMARY KEY ("id_proveedor_categoria")
);

-- CreateTable
CREATE TABLE "detalle_devolucion_cliente" (
    "id_detalle_devolucion_cliente" SERIAL NOT NULL,
    "id_devolucion_cliente" INTEGER,
    "id_detalle_producto" INTEGER,
    "id_detalle_venta" INTEGER,
    "cantidad_cliente_devuelta" INTEGER,
    "cantidad_devuelta_a_cliente" INTEGER,
    "precio_unitario_devolucion" DECIMAL,
    "monto_clientes_productos_devueltos" DECIMAL,
    "estado_condicion_producto" VARCHAR(10),
    "estado_devolucion_proveedor" VARCHAR(20),
    "nombre_producto" VARCHAR(20),

    CONSTRAINT "detalle_devolucion_cliente_pkey" PRIMARY KEY ("id_detalle_devolucion_cliente")
);

-- CreateIndex
CREATE UNIQUE INDEX "acceso_email_key" ON "acceso"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_categorias_nombre" ON "categorias"("nombre_categoria");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cliente_numero_doc" ON "clientes"("numero_doc");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cliente_correo" ON "clientes"("correo_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_permiso_nombre_key" ON "permisos"("permiso_nombre");

-- CreateIndex
CREATE UNIQUE INDEX "uq_proveedores_nit" ON "proveedores"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_correo_key" ON "proveedores"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "roles_rol_nombre_key" ON "roles"("rol_nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_acceso_id_key" ON "usuarios"("acceso_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_documento_key" ON "usuarios"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "uq_proveedor_categoria" ON "proveedor_categoria"("id_proveedor", "id_categoria");

-- AddForeignKey
ALTER TABLE "acceso" ADD CONSTRAINT "acceso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("rol_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "fk_compras_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id_proveedor") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_compra" ADD CONSTRAINT "fk_detalle_compra_compra" FOREIGN KEY ("id_compra") REFERENCES "compras"("id_compra") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_compra" ADD CONSTRAINT "fk_detalle_producto" FOREIGN KEY ("id_detalle_producto") REFERENCES "detalle_productos"("id_detalle_producto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_devolucion_producto" ADD CONSTRAINT "fk_detalle_producto" FOREIGN KEY ("id_detalle_producto") REFERENCES "detalle_productos"("id_detalle_producto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_devolucion_producto" ADD CONSTRAINT "fk_devolucion_producto" FOREIGN KEY ("id_devolucion_producto") REFERENCES "devolucion_producto"("id_devolucion_product") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_productos" ADD CONSTRAINT "detalle_productos_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id_producto") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_venta" ADD CONSTRAINT "fk_detalle_venta" FOREIGN KEY ("id_detalle_producto") REFERENCES "detalle_productos"("id_detalle_producto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_venta" ADD CONSTRAINT "fk_detalle_venta_venta" FOREIGN KEY ("id_venta") REFERENCES "ventas"("id_venta") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "devolucion_cliente" ADD CONSTRAINT "fk_responsable" FOREIGN KEY ("id_responsable") REFERENCES "usuarios"("usuario_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "devolucion_cliente" ADD CONSTRAINT "fk_venta" FOREIGN KEY ("id_venta") REFERENCES "ventas"("id_venta") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "devolucion_producto" ADD CONSTRAINT "fk_responsable" FOREIGN KEY ("id_responsable") REFERENCES "usuarios"("usuario_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_acceso_id_fkey" FOREIGN KEY ("acceso_id") REFERENCES "acceso"("acceso_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto_proveedor" ADD CONSTRAINT "producto_proveedor_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id_producto") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto_proveedor" ADD CONSTRAINT "producto_proveedor_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id_proveedor") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_icu_fkey" FOREIGN KEY ("icu") REFERENCES "impuestos_productos"("id_impuesto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id_categoria") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_iva_fkey" FOREIGN KEY ("iva") REFERENCES "impuestos_productos"("id_impuesto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_porcentaje_incremento_fkey" FOREIGN KEY ("porcentaje_incremento") REFERENCES "impuestos_productos"("id_impuesto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_baja" ADD CONSTRAINT "fk_responsable" FOREIGN KEY ("id_responsable") REFERENCES "usuarios"("usuario_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("permiso_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("rol_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_acceso_id_fkey" FOREIGN KEY ("acceso_id") REFERENCES "acceso"("acceso_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "fk_ventas_clientes" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_productos_baja" ADD CONSTRAINT "detalle_productos_baja_id_baja_productos_fkey" FOREIGN KEY ("id_baja_productos") REFERENCES "productos_baja"("id_baja_productos") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_productos_baja" ADD CONSTRAINT "detalle_productos_baja_id_detalle_productos_fkey" FOREIGN KEY ("id_detalle_productos") REFERENCES "detalle_productos"("id_detalle_producto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedor_categoria" ADD CONSTRAINT "fk_proveedor_categoria_categoria" FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id_categoria") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor_categoria" ADD CONSTRAINT "fk_proveedor_categoria_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id_proveedor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_devolucion_cliente" ADD CONSTRAINT "fk_detalle_producto" FOREIGN KEY ("id_detalle_producto") REFERENCES "detalle_productos"("id_detalle_producto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_devolucion_cliente" ADD CONSTRAINT "fk_detalle_venta" FOREIGN KEY ("id_detalle_venta") REFERENCES "detalle_venta"("id_detalle") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_devolucion_cliente" ADD CONSTRAINT "fk_devolucion_cliente" FOREIGN KEY ("id_devolucion_cliente") REFERENCES "devolucion_cliente"("id_devoluciones_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;
