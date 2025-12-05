const prisma = require("../prisma/prismaClient");

const getLowProducts = async (req, res) => {
  try {
    const lowProducts = await prisma.productos_baja.findMany({
      include: { detalle_productos_baja: true },
    });
    return res.status(200).json(lowProducts);
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener los productos" });
  }
};

const getOneLowProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const lowProduct = await prisma.productos_baja.findUnique({
      where: {
        id_baja_productos: Number(id),
      },
      include: {
        detalle_productos_baja: true,
      },
    });
    return res.status(200).json(lowProduct);
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener el producto" });
  }
};
const searchLowProduct = async (req, res) => {
  const { q } = req.query;

  try {
    // Detecta si el valor es número o texto
    const isNumber = !isNaN(q);

    // Construye condiciones dinámicas según tipo
    const filter = isNumber
      ? {
          OR: [
            { id_baja_productos: { equals: Number(q) } },
            { cantida_baja: { equals: Number(q) } },
            { total_precio_baja: { equals: q } }, // si es string en la BD
          ],
        }
      : {
          OR: [
            {
              nombre_responsable: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              detalle_productos_baja: {
                some: {
                  OR: [
                    {
                      motivo: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      nombre_producto: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            },
          ],
        };

    // Ejecutar búsqueda
    const lowProducts = await prisma.productos_baja.findMany({
      where: filter,
      include: {
        detalle_productos_baja: true,
      },
    });

    return res.status(200).json(lowProducts);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al buscar los productos" });
  }
};

const getResponsable = async (id) => {
  try {
    const responsable = await prisma.usuarios.findUnique({
      where: {
        usuario_id: id,
      },
    });
    return responsable;
  } catch (error) {
    console.log("No se encontro responsable");
  }
};

const createLowProduct = async (req, res) => {
  console.log("====== [createLowProduct] INICIO ======");
  console.log("[1] req.body:", req.body);

  const data = req.body;

  try {
    console.log("[2] Buscando responsable con id_responsable:", data?.id_responsable);
    const responsable = await getResponsable(data.id_responsable);
    console.log("[3] responsable encontrado:", responsable);

    console.log("[4] Validando products:", Array.isArray(data?.products), "len:", data?.products?.length);
    if (!Array.isArray(data.products) || data.products.length === 0) {
      console.log("[4.1] products inválido o vacío");
      return res.status(400).json({ error: "products debe ser un arreglo con al menos 1 item" });
    }

    const cantidad_total_baja = data.products.reduce((acc, p) => acc + p.cantidad, 0);
    const total_precio_baja = data.products.reduce((acc, p) => acc + p.total_producto_baja, 0);

    console.log("[5] cantidad_total_baja:", cantidad_total_baja);
    console.log("[6] total_precio_baja:", total_precio_baja);

    if (!responsable) {
      console.log("[7] No existe responsable => saliendo");
      return res.status(404).json({ error: "Responsable no encontrado" });
    }

    console.log("[8] Entrando a prisma.$transaction...");

    const result = await prisma.$transaction(async (tx) => {
      console.log("---- [TX] INICIO TRANSACCIÓN ----");

      console.log("[TX-1] Creando cabecera productos_baja...");
      const lowProduct = await tx.productos_baja.create({
        data: {
          id_responsable: responsable.usuario_id,
          fecha_baja: new Date(),
          cantida_baja: cantidad_total_baja,
          total_precio_baja: total_precio_baja,
          nombre_responsable: responsable.nombre,
        },
      });
      console.log("[TX-2] Cabecera creada:", lowProduct);

      console.log("[TX-3] Iniciando loop products. Total items:", data.products.length);

      for (let i = 0; i < data.products.length; i++) {
        const p = data.products[i];

        console.log(`\n[TX-LOOP-${i}] =========================`);
        console.log(`[TX-LOOP-${i}] Producto payload p:`, p);

        // Validaciones rápidas para detectar payload raro
        console.log(`[TX-LOOP-${i}] Validando campos mínimos...`, {
          id_detalle_productos: p?.id_detalle_productos,
          cantidad: p?.cantidad,
          motivo: p?.motivo,
          total_producto_baja: p?.total_producto_baja,
        });

        console.log(`[TX-LOOP-${i}] (A) Buscando detalle_producto id_detalle_producto=${p.id_detalle_productos}`);
        const detalle_producto = await tx.detalle_productos.findUnique({
          where: { id_detalle_producto: p.id_detalle_productos },
        });
        console.log(`[TX-LOOP-${i}] (A.1) detalle_producto:`, detalle_producto);

        if (!detalle_producto) {
          console.error(`[TX-LOOP-${i}] ERROR: No existe detalle_productos con id ${p.id_detalle_productos}`);
          throw new Error(`No existe detalle_productos con id ${p.id_detalle_productos}`);
        }

        console.log(`[TX-LOOP-${i}] (B) Buscando producto id_producto=${detalle_producto.id_producto}`);
        const product = await tx.productos.findUnique({
          where: { id_producto: detalle_producto.id_producto },
        });
        console.log(`[TX-LOOP-${i}] (B.1) product:`, product);

        if (!product) {
          console.error(
            `[TX-LOOP-${i}] ERROR: No existe producto asociado al detalle ${p.id_detalle_productos} (id_producto=${detalle_producto.id_producto})`
          );
          throw new Error(
            `No existe producto asociado al detalle ${p.id_detalle_productos}`
          );
        }

        console.log(`[TX-LOOP-${i}] (C) Creando detalle_productos_baja...`);
        const detalle = await tx.detalle_productos_baja.create({
          data: {
            id_baja_productos: lowProduct.id_baja_productos,
            id_detalle_productos: p.id_detalle_productos,
            cantidad: p.cantidad,
            motivo: p.motivo,
            total_producto_baja: p.total_producto_baja,
            nombre_producto: product.nombre,
          },
        });
        console.log(`[TX-LOOP-${i}] (C.1) detalle creado:`, detalle);

        console.log(`[TX-LOOP-${i}] (D) Decrementando stock en detalle_productos (id_detalle_producto=${p.id_detalle_productos}) decrement=${p.cantidad}`);
        const updDetalle = await tx.detalle_productos.update({
          where: { id_detalle_producto: p.id_detalle_productos },
          data: { stock_producto: { decrement: p.cantidad } },
        });
        console.log(`[TX-LOOP-${i}] (D.1) detalle_productos actualizado:`, updDetalle);

        console.log(`[TX-LOOP-${i}] (E) Re-buscando detalle_productos para id_producto...`);
        const detalleProduct = await tx.detalle_productos.findUnique({
          where: { id_detalle_producto: p.id_detalle_productos },
        });
        console.log(`[TX-LOOP-${i}] (E.1) detalleProduct:`, detalleProduct);

        if (!detalleProduct) {
          console.error(`[TX-LOOP-${i}] ERROR: detalleProduct salió null luego de update (raro)`);
          throw new Error(`No se pudo re-consultar detalle_productos con id ${p.id_detalle_productos}`);
        }

        console.log(`[TX-LOOP-${i}] (F) Decrementando stock_actual en productos (id_producto=${detalleProduct.id_producto}) decrement=${p.cantidad}`);
        const updProd = await tx.productos.update({
          where: { id_producto: detalleProduct.id_producto },
          data: { stock_actual: { decrement: p.cantidad } },
        });
        console.log(`[TX-LOOP-${i}] (F.1) productos actualizado:`, updProd);

        const condicionTraslado =
          p.motivo === "Venta unitaria" &&
          p.id_producto_traslado != null &&
          p.cantidad_traslado != null;

        console.log(`[TX-LOOP-${i}] (G) ¿Aplica traslado?`, {
          motivo: p.motivo,
          id_producto_traslado: p.id_producto_traslado,
          cantidad_traslado: p.cantidad_traslado,
          condicionTraslado,
        });

        if (condicionTraslado) {
          console.log(`[TX-LOOP-${i}] (G.1) Entró a traslado ✅`);

          console.log(
            `[TX-LOOP-${i}] (H) Incrementando stock_producto en detalle_productos traslado (id_detalle_producto=${p.id_producto_traslado}) increment=${p.cantidad_traslado}`
          );

          const productTraslado = await tx.detalle_productos.update({
            where: { id_detalle_producto: p.id_producto_traslado },
            data: { stock_producto: { increment: p.cantidad_traslado } },
          });
          console.log(`[TX-LOOP-${i}] (H.1) detalle_productos traslado actualizado:`, productTraslado);

          console.log(
            `[TX-LOOP-${i}] (I) Incrementando stock_actual en productos traslado (id_producto=${productTraslado.id_producto}) increment=${p.cantidad_traslado}`
          );

          const updProdTraslado = await tx.productos.update({
            where: { id_producto: productTraslado.id_producto },
            data: { stock_actual: { increment: p.cantidad_traslado } },
          });
          console.log(`[TX-LOOP-${i}] (I.1) productos traslado actualizado:`, updProdTraslado);
        }

        console.log(`[TX-LOOP-${i}] FIN ITEM ✅`);
      }

      console.log("[TX-4] Consultando retorno findUnique productos_baja + include detalle...");
      const finalResult = await tx.productos_baja.findUnique({
        where: { id_baja_productos: lowProduct.id_baja_productos },
        include: { detalle_productos_baja: true },
      });
      console.log("[TX-5] Resultado final:", finalResult);

      console.log("---- [TX] FIN TRANSACCIÓN ----");
      return finalResult;
    });

    console.log("[9] Transacción OK, respondiendo 201");
    return res.status(201).json(result);
  } catch (error) {
    console.error("====== [createLowProduct] ERROR ======");
    console.error(error);

    // Para debugear de verdad (temporal)
    return res.status(500).json({
      error: "Error al crear el producto",
      detalle: error?.message,
    });
  } finally {
    console.log("====== [createLowProduct] FIN ======");
  }
};
;

module.exports = {
  getLowProducts,
  createLowProduct,
  searchLowProduct,
  getOneLowProduct,
  getResponsable,
};
