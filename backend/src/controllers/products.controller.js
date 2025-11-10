// backend/src/controllers/products.controller.js
require("dotenv").config();
const prisma = require("../prisma/prismaClient");
const fs = require("fs/promises");
const cloudinary = require("cloudinary").v2;

// ───────── CONFIG CLOUDINARY ─────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ───────── HELPERS IMPUESTOS ─────────

// Si val es 0, vacío, null → no usar impuesto (null)
// Si trae un número >0 → buscamos/creamos un registro en impuestos_productos
const resolveImpuestoId = async (val, tipo = "IMP") => {
  if (
    val === undefined ||
    val === null ||
    val === "" ||
    Number.isNaN(Number(val)) ||
    Number(val) === 0
  ) {
    return null; // sin impuesto
  }

  const valor = Number(val);

  // 1. Buscar si ya existe un impuesto con ese valor
  const existing = await prisma.impuestos_productos.findFirst({
    where: { valor_impuesto: valor },
  });
  if (existing) return existing.id_impuesto;

  // 2. Si no existe, lo creamos
  const nombre = `${tipo}_${valor}`.slice(0, 30); // por si acaso limitar a 30 chars
  const created = await prisma.impuestos_productos.create({
    data: {
      nombre_impuesto: nombre,
      valor_impuesto: valor,
    },
  });

  return created.id_impuesto;
};

// --------------------- GETs ---------------------
const getAllProducts = async (_req, res) => {
  try {
    const products = await prisma.productos.findMany({
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
        // Opcional: incluir info de impuestos
        impuestos_productos_productos_ivaToimpuestos_productos: true,
        impuestos_productos_productos_icuToimpuestos_productos: true,
        impuestos_productos_productos_porcentaje_incrementoToimpuestos_productos: true,
      },
    });

    const formatted = products.map((p) => ({
      ...p,
      categoria: p.categorias ? p.categorias.nombre_categoria : null,
      proveedores: p.producto_proveedor.map((pp) => pp.proveedores),
      iva_detalle: p.impuestos_productos_productos_ivaToimpuestos_productos || null,
      icu_detalle: p.impuestos_productos_productos_icuToimpuestos_productos || null,
      incremento_detalle:
        p.impuestos_productos_productos_porcentaje_incrementoToimpuestos_productos ||
        null,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("❌ Error al obtener productos:", error);
    res.status(500).json({ message: "Error al obtener productos." });
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
            categorias: {
              select: { id_categoria: true, nombre_categoria: true },
            },
            impuestos_productos_productos_ivaToimpuestos_productos: true,
            impuestos_productos_productos_icuToimpuestos_productos: true,
            impuestos_productos_productos_porcentaje_incrementoToimpuestos_productos:
              true,
          },
        },
      },
    });

    const products = links.map((l) => ({
      ...l.productos,
      categoria: l.productos.categorias?.nombre_categoria || null,
      iva_detalle:
        l.productos.impuestos_productos_productos_ivaToimpuestos_productos ||
        null,
      icu_detalle:
        l.productos.impuestos_productos_productos_icuToimpuestos_productos ||
        null,
      incremento_detalle:
        l.productos
          .impuestos_productos_productos_porcentaje_incrementoToimpuestos_productos ||
        null,
    }));

    res.json(products);
  } catch (error) {
    console.error("❌ Error al obtener productos del proveedor:", error);
    res
      .status(500)
      .json({ message: "Error al obtener productos del proveedor." });
  }
};

// -------------------- CREATE --------------------
const createProduct = async (req, res) => {
  let tempPath = null;

  try {
    const {
      nombre,
      descripcion,
      stock_actual,
      stock_minimo,
      stock_maximo,
      estado, // boolean (o string "true"/"false")
      id_categoria,
      iva,
      icu,
      porcentaje_incremento,
      costo_unitario,
      precio_venta,
      id_proveedor,
    } = req.body;

    // Validaciones mínimas
    if (!nombre || !id_categoria || !id_proveedor) {
      return res.status(400).json({
        message: "nombre, id_categoria e id_proveedor son requeridos",
      });
    }
    if (costo_unitario == null || isNaN(Number(costo_unitario))) {
      return res
        .status(400)
        .json({ message: "costo_unitario es requerido y debe ser numérico" });
    }
    if (precio_venta == null || isNaN(Number(precio_venta))) {
      return res
        .status(400)
        .json({ message: "precio_venta es requerido y debe ser numérico" });
    }

    // Verificar FK: categoría y proveedor existen
    const [cat, prov] = await Promise.all([
      prisma.categorias.findUnique({
        where: { id_categoria: Number(id_categoria) },
      }),
      prisma.proveedores.findUnique({
        where: { id_proveedor: Number(id_proveedor) },
      }),
    ]);
    if (!cat) return res.status(400).json({ message: "La categoría no existe" });
    if (!prov) return res.status(400).json({ message: "El proveedor no existe" });

    // ───────── RESOLVER IMPUESTOS (usa tabla impuestos_productos) ─────────
    const ivaId = await resolveImpuestoId(iva, "IVA");
    const icuId = await resolveImpuestoId(icu, "ICU");
    const porcId = await resolveImpuestoId(
      porcentaje_incremento,
      "INC" // incremento
    );

    // ───────── SUBIR IMAGEN (SI VIENE) ─────────
    let imageUrl = null;
    if (req.file) {
      tempPath = req.file.path; // para borrar luego

      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "kajamart/products",
        });

        imageUrl = uploadResult.secure_url;
      } catch (err) {
        console.error("❌ Error al subir imagen a Cloudinary:", err);
        return res
          .status(500)
          .json({ message: "Error al subir la imagen a Cloudinary" });
      }
    }

    // Crear producto
    const newProduct = await prisma.productos.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        stock_actual: Number(stock_actual) || 0,
        stock_minimo: Number(stock_minimo) || 0,
        stock_maximo: Number(stock_maximo) || 0,
        estado:
          typeof estado === "boolean"
            ? estado
            : String(estado).toLowerCase() === "true",
        id_categoria: Number(id_categoria),

        iva: ivaId, // FK → impuestos_productos.id_impuesto, puede ser null
        icu: icuId,
        porcentaje_incremento: porcId,

        costo_unitario: Number(costo_unitario),
        precio_venta: Number(precio_venta),
        url_imagen: imageUrl, // link Cloudinary
      },
    });

    // Vincular con proveedor (producto_proveedor)
    await prisma.producto_proveedor.create({
      data: {
        id_proveedor: Number(id_proveedor),
        id_producto: newProduct.id_producto,
        estado_producto_proveedor: true,
      },
    });

    res.status(201).json({
      message: "✅ Producto creado exitosamente",
      newProduct,
    });
  } catch (error) {
    console.error("❌ Error al crear producto:", error);
    res.status(500).json({ message: "Error al crear producto" });
  } finally {
    // ───────── BORRAR ARCHIVO LOCAL TEMPORAL ─────────
    if (tempPath) {
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        console.warn("⚠️ No se pudo borrar el archivo temporal:", e.message);
      }
    }
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
    if (!exists) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

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
      id_proveedor, // si llega, re-enlazamos
      url_imagen, // opcionalmente permitir link manual
    } = req.body;

    // Si llega id_categoria, validar existencia
    if (id_categoria) {
      const cat = await prisma.categorias.findUnique({
        where: { id_categoria: Number(id_categoria) },
      });
      if (!cat) {
        return res.status(400).json({ message: "La categoría no existe" });
      }
    }

    // ───────── RESOLVER IMPUESTOS SOLO SI LLEGAN EN EL BODY ─────────
    let ivaId, icuId, porcId;

    if (iva !== undefined) ivaId = await resolveImpuestoId(iva, "IVA");
    if (icu !== undefined) icuId = await resolveImpuestoId(icu, "ICU");
    if (porcentaje_incremento !== undefined)
      porcId = await resolveImpuestoId(porcentaje_incremento, "INC");

    // ───────── SUBIR NUEVA IMAGEN SI VIENE UN ARCHIVO ─────────
    let finalImageUrl = url_imagen !== undefined ? url_imagen : undefined;

    if (req.file) {
      tempPath = req.file.path;
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "kajamart/products",
        });
        finalImageUrl = uploadResult.secure_url;
      } catch (err) {
        console.error("❌ Error al subir imagen a Cloudinary (update):", err);
        return res
          .status(500)
          .json({ message: "Error al subir la imagen a Cloudinary" });
      }
    }

    // Armar objeto de actualización solo con campos definidos
    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (descripcion !== undefined) data.descripcion = descripcion || null;
    if (stock_actual !== undefined)
      data.stock_actual = Number(stock_actual) || 0;
    if (stock_minimo !== undefined)
      data.stock_minimo = Number(stock_minimo) || 0;
    if (stock_maximo !== undefined)
      data.stock_maximo = Number(stock_maximo) || 0;
    if (estado !== undefined)
      data.estado =
        typeof estado === "boolean"
          ? estado
          : String(estado).toLowerCase() === "true";
    if (id_categoria !== undefined) data.id_categoria = Number(id_categoria);
    if (ivaId !== undefined) data.iva = ivaId; // puede ser null para borrar
    if (icuId !== undefined) data.icu = icuId;
    if (porcId !== undefined) data.porcentaje_incremento = porcId;
    if (costo_unitario !== undefined)
      data.costo_unitario = Number(costo_unitario);
    if (precio_venta !== undefined)
      data.precio_venta = Number(precio_venta);
    if (finalImageUrl !== undefined)
      data.url_imagen = finalImageUrl || null;

    const updated = await prisma.productos.update({
      where: { id_producto: Number(id) },
      data,
    });

    // Si llega id_proveedor, re-enlazar (simple: limpiar y crear el vínculo actual)
    if (id_proveedor !== undefined) {
      const prov = await prisma.proveedores.findUnique({
        where: { id_proveedor: Number(id_proveedor) },
      });
      if (!prov) {
        return res.status(400).json({ message: "El proveedor no existe" });
      }

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
    if (tempPath) {
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        console.warn("⚠️ No se pudo borrar el archivo temporal:", e.message);
      }
    }
  }
};

// -------------------- DELETE --------------------
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await prisma.productos.findUnique({
      where: { id_producto: Number(id) },
    });
    if (!exists)
      return res.status(404).json({ message: "Producto no encontrado" });

    await prisma.producto_proveedor.deleteMany({
      where: { id_producto: Number(id) },
    });
    await prisma.productos.delete({ where: { id_producto: Number(id) } });

    res.json({ message: "✅ Producto eliminado" });
  } catch (error) {
    console.error("❌ Error al eliminar producto:", error);
    res.status(500).json({ message: "Error al eliminar producto" });
  }
};

// -------------------- RANDOM BY CATEGORY --------------------
const getRandomProduct = async (req, res) => {
  const { q } = req.query;
  const id_categoria_int = parseInt(q);
  console.log("Random product, categoria:", q);

  try {
    const ids = await prisma.productos.findMany({
      where: {
        id_categoria: {
          equals: id_categoria_int,
        },
      },
    });

    if (ids.length === 0) {
      return res.status(404).json({
        message: "No se encontraron productos",
      });
    }

    while (true) {
      const idx = Math.floor(Math.random() * ids.length);
      const product = await prisma.productos.findUnique({
        where: {
          id_producto: ids[idx].id_producto,
        },
      });
      if (product) {
        return res.status(200).json({ product });
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error al obtener el producto",
    });
  }
};

module.exports = {
  getAllProducts,
  getProductsBySupplier,
  createProduct,
  updateProduct,
  deleteProduct,
  getRandomProduct,
};
