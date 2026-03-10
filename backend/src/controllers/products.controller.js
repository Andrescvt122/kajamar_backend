// kajamar_backend/backend/src/controllers/products.controller.js
require("dotenv").config();
const prisma = require("../prisma/prismaClient");
const fs = require("fs/promises");
const cloudinary = require("cloudinary").v2;
const { removeImageBackground } = require("../utils/removeBackground");

// ───────── CONFIG CLOUDINARY ─────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ───────── HELPERS IMAGEN ─────────
const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (_) {}
};

const uploadWithBgRemoval = async (originalPath) => {
  let processedPath = null;

  try {
    if (typeof removeImageBackground !== "function") {
      console.error(
        "❌ removeImageBackground no es una función. Revisa ../utils/removeBackground"
      );
      throw new Error("removeImageBackground not available");
    }

    processedPath = await removeImageBackground(originalPath);
    console.log("🧼 remove.bg processedPath:", processedPath);

    const finalPath = processedPath || originalPath;

    const uploadResult = await cloudinary.uploader.upload(finalPath, {
      folder: "kajamart/products",
      resource_type: "image",
      format: "png",
      flags: "preserve_transparency",
    });

    return { url: uploadResult.secure_url, processedPath };
  } catch (err) {
    console.error(
      "⚠️ BG removal falló, subiendo original. Motivo:",
      err?.message || err
    );

    const uploadResult = await cloudinary.uploader.upload(originalPath, {
      folder: "kajamart/products",
      resource_type: "image",
    });

    return { url: uploadResult.secure_url, processedPath: null };
  }
};

// ───────── HELPERS IMPUESTOS ─────────
const resolveImpuestoId = async (val, tipo = "IMP") => {
  if (
    val === undefined ||
    val === null ||
    val === "" ||
    Number.isNaN(Number(val)) ||
    Number(val) === 0
  ) {
    return null;
  }

  const valor = Number(val);

  const existing = await prisma.impuestos_productos.findFirst({
    where: { valor_impuesto: valor },
  });
  if (existing) return existing.id_impuesto;

  const nombre = `${tipo}_${valor}`.slice(0, 30);
  const created = await prisma.impuestos_productos.create({
    data: {
      nombre_impuesto: nombre,
      valor_impuesto: valor,
    },
  });

  return created.id_impuesto;
};
// -------------------- GET PRODUCT BY ID --------------------
const getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await prisma.productos.findUnique({
      where: { id_producto: Number(id) },
      include: {
        categorias: { select: { id_categoria: true, nombre_categoria: true } },
        producto_proveedor: {
          include: {
            proveedores: {
              select: { id_proveedor: true, nombre: true, nit: true },
            },
          },
        },
        impuestos_productos_productos_ivaToimpuestos_productos: true,
        impuestos_productos_productos_icuToimpuestos_productos: true,
        impuestos_productos_productos_porcentaje_incrementoToimpuestos_productos: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const formatted = {
      ...product,
      categoria: product.categorias?.nombre_categoria || null,
      proveedores: product.producto_proveedor.map((pp) => pp.proveedores),
      iva_detalle:
        product.impuestos_productos_productos_ivaToimpuestos_productos || null,
      icu_detalle:
        product.impuestos_productos_productos_icuToimpuestos_productos || null,
      incremento_detalle:
        product.impuestos_productos_productos_porcentaje_incrementoToimpuestos_productos ||
        null,
    };

    return res.json(formatted);
  } catch (error) {
    console.error("❌ Error al obtener producto:", error);
    return res.status(500).json({ message: "Error al obtener el producto" });
  }
};
// --------------------- GETs ---------------------
const getAllProducts = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.productos.findMany({
        skip,
        take: limit,
        orderBy: { nombre: "asc" },
        include: {
          categorias: { select: { id_categoria: true, nombre_categoria: true } },
          producto_proveedor: {
            include: {
              proveedores: {
                select: { id_proveedor: true, nombre: true, nit: true },
              },
            },
          },
          impuestos_productos_productos_ivaToimpuestos_productos: true,
          impuestos_productos_productos_icuToimpuestos_productos: true,
          impuestos_productos_productos_porcentaje_incrementoToimpuestos_productos: true,
        },
      }),
      prisma.productos.count(),
    ]);

    const formatted = products.map((p) => ({
      ...p,
      categoria: p.categorias ? p.categorias.nombre_categoria : null,
      proveedores: p.producto_proveedor.map((pp) => pp.proveedores),
      iva_detalle:
        p.impuestos_productos_productos_ivaToimpuestos_productos || null,
      icu_detalle:
        p.impuestos_productos_productos_icuToimpuestos_productos || null,
      incremento_detalle:
        p.impuestos_productos_productos_porcentaje_incrementoToimpuestos_productos ||
        null,
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: formatted,
      currentPage: page,
      totalPages,
      totalItems: total,
    });

  } catch (error) {

    console.error("❌ Error al obtener productos:", error);

    res.status(500).json({
      message: "Error al obtener productos.",
    });

  }
};

const getProductsBySupplier = async (req, res) => {
  const { id } = req.params;
  try {
    const links = await prisma.producto_proveedor.findMany({
      where: { id_proveedor: Number(id) },
      include: {
        productos: {
          include: {
            categorias: { select: { id_categoria: true, nombre_categoria: true } },
            impuestos_productos_productos_ivaToimpuestos_productos: true,
            impuestos_productos_productos_icuToimpuestos_productos: true,
            impuestos_productos_productos_porcentaje_incrementoToimpuestos_productos: true,
          },
        },
      },
    });

    const products = links.map((l) => ({
      ...l.productos,
      categoria: l.productos.categorias?.nombre_categoria || null,
      iva_detalle: l.productos.impuestos_productos_productos_ivaToimpuestos_productos || null,
      icu_detalle: l.productos.impuestos_productos_productos_icuToimpuestos_productos || null,
      incremento_detalle:
        l.productos.impuestos_productos_productos_porcentaje_incrementoToimpuestos_productos ||
        null,
    }));

    res.json(products);
  } catch (error) {
    console.error("❌ Error al obtener productos del proveedor:", error);
    res.status(500).json({ message: "Error al obtener productos del proveedor." });
  }
};

// -------------------- CREATE --------------------
const createProduct = async (req, res) => {
  let tempPath = null;

  try {
    const {
      nombre,
      dev_producto = null,
      baja_producto = null,
      descripcion,
      stock_actual,
      stock_minimo,
      stock_maximo,
      estado,
      id_categoria,
      iva,
      icu,
      porcentaje_incremento,
      costo_unitario,
      precio_venta,
      cantidad_unitaria,
      id_proveedor, // ahora opcional (se asocia desde otro módulo)
    } = req.body;

    if (!nombre || !id_categoria) {
      return res.status(400).json({ message: "nombre e id_categoria son requeridos" });
    }

    const cat = await prisma.categorias.findUnique({
      where: { id_categoria: Number(id_categoria) },
    });
    if (!cat) return res.status(400).json({ message: "La categoría no existe" });

    if (id_proveedor) {
      const prov = await prisma.proveedores.findUnique({
        where: { id_proveedor: Number(id_proveedor) },
      });
      if (!prov) return res.status(400).json({ message: "El proveedor no existe" });
    }

    const ivaId = await resolveImpuestoId(iva, "IVA");
    const icuId = await resolveImpuestoId(icu, "ICU");
    const porcId = await resolveImpuestoId(porcentaje_incremento, "INC");

    // ✅ IMAGEN CON REMOVE.BG
    let imageUrl = null;
    if (req.file) {
      const originalPath = req.file.path;
      tempPath = originalPath;

      const { url, processedPath } = await uploadWithBgRemoval(originalPath);
      imageUrl = url;

      await safeUnlink(originalPath);
      await safeUnlink(processedPath);
      tempPath = null;
    }

    // precios
    let costoUnitarioNum = Number(costo_unitario);
    let precioVentaNum = Number(precio_venta);

    const hasCosto =
      costo_unitario !== undefined &&
      costo_unitario !== "" &&
      !Number.isNaN(costoUnitarioNum) &&
      costoUnitarioNum > 0;

    const hasPrecio =
      precio_venta !== undefined &&
      precio_venta !== "" &&
      !Number.isNaN(precioVentaNum) &&
      precioVentaNum > 0;

    if (!hasCosto && !hasPrecio) {
      costoUnitarioNum = 1000;
      precioVentaNum = precioVentaNum ?? 2000;
    } else if (hasCosto && !hasPrecio) {
      if (costoUnitarioNum <= 0) costoUnitarioNum = 1000;
      precioVentaNum = Math.max(costoUnitarioNum * 1.2, costoUnitarioNum + 1);
    } else if (!hasCosto && hasPrecio) {
      if (precioVentaNum <= 0) precioVentaNum = 2000;
      costoUnitarioNum = Math.max(1, Math.floor(precioVentaNum / 2));
    } else {
      if (costoUnitarioNum <= 0) costoUnitarioNum = 1000;
      if (precioVentaNum <= 0) precioVentaNum = costoUnitarioNum * 1.2;
    }

    if (precioVentaNum <= costoUnitarioNum) precioVentaNum = costoUnitarioNum + 1;

    const newProduct = await prisma.productos.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        desde_baja_productos: dev_producto,
        desde_dev_productos: baja_producto,
        stock_actual: Number(stock_actual) || 0,
        stock_minimo: Number(stock_minimo) || 0,
        stock_maximo: Number(stock_maximo) || 0,
        estado:
          typeof estado === "boolean" ? estado : String(estado).toLowerCase() === "true",
        id_categoria: Number(id_categoria),

        iva: ivaId,
        icu: icuId,
        porcentaje_incremento: porcId,
        costo_unitario: costoUnitarioNum,
        precio_venta: precioVentaNum,
        cantidad_unitaria: Number(cantidad_unitaria),
        url_imagen: imageUrl,
      },
    });

    if (id_proveedor) {
      await prisma.producto_proveedor.create({
        data: {
          id_proveedor: Number(id_proveedor),
          id_producto: newProduct.id_producto,
          estado_producto_proveedor: true,
        },
      });
    }

    res.status(201).json({ message: "✅ Producto creado exitosamente", newProduct });
  } catch (error) {
    console.error("❌ Error al crear producto:", error);
    res.status(500).json({ message: "Error al crear producto" });
  } finally {
    if (tempPath) await safeUnlink(tempPath);
  }
};

// -------------------- UPDATE --------------------
const updateProduct = async (req, res) => {
  const { id } = req.params;
  let tempPath = null;

  try {
    const exists = await prisma.productos.findUnique({
      where: { id_producto: Number(id) },
    });
    if (!exists) return res.status(404).json({ message: "Producto no encontrado" });

    const {
      nombre,
      descripcion,
      stock_actual,
      stock_minimo,
      stock_maximo,
      estado,
      id_categoria,
      iva,
      icu,
      porcentaje_incremento,
      costo_unitario,
      precio_venta,
      id_proveedor,
      url_imagen,
    } = req.body;

    if (id_categoria) {
      const cat = await prisma.categorias.findUnique({
        where: { id_categoria: Number(id_categoria) },
      });
      if (!cat) return res.status(400).json({ message: "La categoría no existe" });
    }

    if (
      costo_unitario !== undefined &&
      precio_venta !== undefined &&
      !Number.isNaN(Number(costo_unitario)) &&
      !Number.isNaN(Number(precio_venta))
    ) {
      if (Number(precio_venta) <= Number(costo_unitario)) {
        return res.status(400).json({
          message: "El precio de venta debe ser mayor al costo unitario.",
        });
      }
    }

    let ivaId, icuId, porcId;
    if (iva !== undefined) ivaId = await resolveImpuestoId(iva, "IVA");
    if (icu !== undefined) icuId = await resolveImpuestoId(icu, "ICU");
    if (porcentaje_incremento !== undefined)
      porcId = await resolveImpuestoId(porcentaje_incremento, "INC");

    // ✅ IMAGEN CON REMOVE.BG EN UPDATE
    let finalImageUrl = url_imagen !== undefined ? url_imagen : undefined;

    if (req.file) {
      const originalPath = req.file.path;
      tempPath = originalPath;

      const { url, processedPath } = await uploadWithBgRemoval(originalPath);
      finalImageUrl = url;

      await safeUnlink(originalPath);
      await safeUnlink(processedPath);
      tempPath = null;
    }

    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (descripcion !== undefined) data.descripcion = descripcion || null;
    if (stock_actual !== undefined) data.stock_actual = Number(stock_actual) || 0;
    if (stock_minimo !== undefined) data.stock_minimo = Number(stock_minimo) || 0;
    if (stock_maximo !== undefined) data.stock_maximo = Number(stock_maximo) || 0;
    if (estado !== undefined)
      data.estado =
        typeof estado === "boolean" ? estado : String(estado).toLowerCase() === "true";
    if (id_categoria !== undefined) data.id_categoria = Number(id_categoria);

    if (ivaId !== undefined) data.iva = ivaId;
    if (icuId !== undefined) data.icu = icuId;
    if (porcId !== undefined) data.porcentaje_incremento = porcId;

    if (costo_unitario !== undefined) data.costo_unitario = Number(costo_unitario);
    if (precio_venta !== undefined) data.precio_venta = Number(precio_venta);

    if (finalImageUrl !== undefined) data.url_imagen = finalImageUrl || null;

    const updated = await prisma.productos.update({
      where: { id_producto: Number(id) },
      data,
    });

    if (id_proveedor !== undefined) {
      const prov = await prisma.proveedores.findUnique({
        where: { id_proveedor: Number(id_proveedor) },
      });
      if (!prov) return res.status(400).json({ message: "El proveedor no existe" });

      await prisma.producto_proveedor.deleteMany({
        where: { id_producto: Number(id) },
      });
      await prisma.producto_proveedor.create({
        data: {
          id_producto: Number(id),
          id_proveedor: Number(id_proveedor),
          estado_producto_proveedor: true,
        },
      });
    }

    res.json({ message: "✅ Producto actualizado", product: updated });
  } catch (error) {
    console.error("❌ Error al actualizar producto:", error);
    res.status(500).json({ message: "Error al actualizar producto" });
  } finally {
    if (tempPath) await safeUnlink(tempPath);
  }
};

// -------------------- DELETE --------------------
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const productId = Number(id);

  try {
    const exists = await prisma.productos.findUnique({
      where: { id_producto: productId },
    });
    if (!exists) return res.status(404).json({ message: "Producto no encontrado" });

    const tieneMovimientos = await prisma.detalle_productos.findFirst({
      where: {
        id_producto: productId,
        OR: [
          { detalle_venta: { some: {} } },
          { detalle_compra: { some: {} } },
          // ⚠️ ajusta estos nombres a tu schema real
          { detalle_devolucion_producto: { some: {} } },
          { detalle_productos_baja: { some: {} } },
        ],
      },
      select: { id_detalle_producto: true },
    });

    if (tieneMovimientos) {
      return res.status(400).json({
        message:
          "No se puede eliminar el producto porque tiene movimientos de inventario (compras, ventas, devoluciones o bajas) asociados.",
      });
    }

    await prisma.producto_proveedor.deleteMany({ where: { id_producto: productId } });
    await prisma.detalle_productos.deleteMany({ where: { id_producto: productId } });
    await prisma.productos.delete({ where: { id_producto: productId } });

    return res.json({ message: "✅ Producto eliminado correctamente." });
  } catch (error) {
    console.error("❌ Error al eliminar producto:", error);

    if (error.code === "P2003") {
      return res.status(400).json({
        message:
          "No se puede eliminar el producto porque tiene información relacionada en el sistema.",
      });
    }

    return res.status(500).json({ message: "Error al eliminar producto" });
  }
};

// -------------------- RANDOM BY CATEGORY --------------------
const getRandomProduct = async (req, res) => {
  const { q } = req.query;
  const id_categoria_int = parseInt(q);

  try {
    const ids = await prisma.productos.findMany({
      where: { id_categoria: { equals: id_categoria_int } },
    });

    if (ids.length === 0) {
      return res.status(404).json({ message: "No se encontraron productos" });
    }

    while (true) {
      const idx = Math.floor(Math.random() * ids.length);
      const product = await prisma.productos.findUnique({
        where: { id_producto: ids[idx].id_producto },
      });
      if (product) return res.status(200).json({ product });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error al obtener el producto" });
  }
};

const getProductsByCategory = async (req, res) => {
  const q = req.query.q;

  try {
    const produts = await prisma.productos.findMany({
      where: { id_categoria: { equals: Number(q) } },
      include: { detalle_productos: true, categorias: true },
    });

    return res.status(200).json(produts);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error al obtener los productos" });
  }
};

module.exports = {
  getAllProducts,
  getProductsBySupplier,
  createProduct,
  updateProduct,
  deleteProduct,
  getRandomProduct,
  getProductsByCategory,
  getProductById,
};
