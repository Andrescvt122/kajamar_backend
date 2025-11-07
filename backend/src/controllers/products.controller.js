const prisma = require("../prisma/prismaClient");

// Utilidad rápida para validar URL http/https
const isHttpUrl = (u) => {
  if (!u || typeof u !== "string") return false;
  try {
    const url = new URL(u);
    return (url.protocol === "http:" || url.protocol === "https:") && u.length <= 255;
  } catch (_) {
    return false;
  }
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
            proveedores: { select: { id_proveedor: true, nombre: true, nit: true } },
          },
        },
      },
    });

    const formatted = products.map((p) => ({
      ...p,
      categoria: p.categorias ? p.categorias.nombre_categoria : null,
      proveedores: p.producto_proveedor.map((pp) => pp.proveedores),
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
          include: { categorias: { select: { id_categoria: true, nombre_categoria: true } } },
        },
      },
    });

    const products = links.map((l) => ({
      ...l.productos,
      categoria: l.productos.categorias?.nombre_categoria || null,
    }));

    res.json(products);
  } catch (error) {
    console.error("❌ Error al obtener productos del proveedor:", error);
    res.status(500).json({ message: "Error al obtener productos del proveedor." });
  }
};

// -------------------- CREATE --------------------
const createProduct = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      stock_actual,
      stock_minimo,
      stock_maximo,
      estado,                 // boolean
      id_categoria,           // requerido
      iva,                    // id impuesto (opcional/req según tu negocio)
      icu,                    // id impuesto (opcional/req según tu negocio)
      porcentaje_incremento,  // id impuesto (opcional/req según tu negocio)
      costo_unitario,         // requerido (Int)
      precio_venta,           // requerido (Int)
      id_proveedor,           // requerido para linkear
      url_imagen,             // ← Cloudinary URL
    } = req.body;

    // Validaciones mínimas
    if (!nombre || !id_categoria || !id_proveedor) {
      return res.status(400).json({
        message: "nombre, id_categoria e id_proveedor son requeridos",
      });
    }
    if (costo_unitario == null || isNaN(Number(costo_unitario))) {
      return res.status(400).json({ message: "costo_unitario es requerido y debe ser numérico" });
    }
    if (precio_venta == null || isNaN(Number(precio_venta))) {
      return res.status(400).json({ message: "precio_venta es requerido y debe ser numérico" });
    }
    if (url_imagen && !isHttpUrl(url_imagen)) {
      return res.status(400).json({ message: "url_imagen inválida (debe ser http/https y <= 255 chars)" });
    }

    // Verificar FK: categoría y proveedor existen
    const [cat, prov] = await Promise.all([
      prisma.categorias.findUnique({ where: { id_categoria: Number(id_categoria) } }),
      prisma.proveedores.findUnique({ where: { id_proveedor: Number(id_proveedor) } }),
    ]);
    if (!cat) return res.status(400).json({ message: "La categoría no existe" });
    if (!prov) return res.status(400).json({ message: "El proveedor no existe" });

    // (Opcional) si manejas tablas de impuestos, validar existencia:
    // if (iva && !(await prisma.impuestos_productos.findUnique({ where: { id_impuesto: Number(iva) } })))
    //   return res.status(400).json({ message: "IVA no existe" });
    // ... repetir para icu/porcentaje_incremento si aplica

    // Crear producto
    const newProduct = await prisma.productos.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        stock_actual: Number(stock_actual) || 0,
        stock_minimo: Number(stock_minimo) || 0,
        stock_maximo: Number(stock_maximo) || 0,
        estado: typeof estado === "boolean" ? estado : true,
        id_categoria: Number(id_categoria),
        iva: Number(iva) || 0,
        icu: Number(icu) || 0,
        porcentaje_incremento: Number(porcentaje_incremento) || 0,
        costo_unitario: Number(costo_unitario),
        precio_venta: Number(precio_venta),
        url_imagen: url_imagen || null,  // ← guardamos el link de Cloudinary tal cual
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
    // P2003 => FK; P2002 => unique
    res.status(500).json({ message: "Error al crear producto" });
  }
};

// -------------------- UPDATE --------------------
const updateProduct = async (req, res) => {
  const { id } = req.params;
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
      id_proveedor,     // si llega, re-enlazamos
      url_imagen,
    } = req.body;

    if (url_imagen && !isHttpUrl(url_imagen)) {
      return res.status(400).json({ message: "url_imagen inválida (http/https y <= 255 chars)" });
    }

    // Si llega id_categoria, validar existencia
    if (id_categoria) {
      const cat = await prisma.categorias.findUnique({ where: { id_categoria: Number(id_categoria) } });
      if (!cat) return res.status(400).json({ message: "La categoría no existe" });
    }

    // Armar objeto de actualización solo con campos definidos
    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (descripcion !== undefined) data.descripcion = descripcion || null;
    if (stock_actual !== undefined) data.stock_actual = Number(stock_actual) || 0;
    if (stock_minimo !== undefined) data.stock_minimo = Number(stock_minimo) || 0;
    if (stock_maximo !== undefined) data.stock_maximo = Number(stock_maximo) || 0;
    if (estado !== undefined) data.estado = !!estado;
    if (id_categoria !== undefined) data.id_categoria = Number(id_categoria);
    if (iva !== undefined) data.iva = Number(iva) || 0;
    if (icu !== undefined) data.icu = Number(icu) || 0;
    if (porcentaje_incremento !== undefined) data.porcentaje_incremento = Number(porcentaje_incremento) || 0;
    if (costo_unitario !== undefined) data.costo_unitario = Number(costo_unitario);
    if (precio_venta !== undefined) data.precio_venta = Number(precio_venta);
    if (url_imagen !== undefined) data.url_imagen = url_imagen || null;

    const updated = await prisma.productos.update({
      where: { id_producto: Number(id) },
      data,
    });

    // Si llega id_proveedor, re-enlazar (simple: limpiar y crear el vínculo actual)
    if (id_proveedor !== undefined) {
      const prov = await prisma.proveedores.findUnique({
        where: { id_proveedor: Number(id_proveedor) },
      });
      if (!prov) return res.status(400).json({ message: "El proveedor no existe" });

      await prisma.producto_proveedor.deleteMany({ where: { id_producto: Number(id) } });
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
  }
};

// -------------------- DELETE --------------------
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await prisma.productos.findUnique({
      where: { id_producto: Number(id) },
    });
    if (!exists) return res.status(404).json({ message: "Producto no encontrado" });

    await prisma.producto_proveedor.deleteMany({ where: { id_producto: Number(id) } });
    await prisma.productos.delete({ where: { id_producto: Number(id) } });

    res.json({ message: "✅ Producto eliminado" });
  } catch (error) {
    console.error("❌ Error al eliminar producto:", error);
    res.status(500).json({ message: "Error al eliminar producto" });
  }
};

const getRandomProduct = async (req,res)=>{
    const {q} = req.query;
    const id_categoria_int = parseInt(q)
    console.log(q);
    try {
        const ids = await prisma.productos.findMany({
            where: {
                id_categoria: {
                    equals: id_categoria_int
                }
            }
        })
        if (ids.length === 0){
            return res.status(404).json({
                message: "No se encontraron productos"
            })
        }
        while (true){
        const id_producto = Math.floor(Math.random() * ids.length)
        const product = await prisma.productos.findUnique({
            where: {
                id_producto: ids[id_producto].id_producto
            }
        })
        if (product){
            return res.status(200).json({
                product
            });
        }
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Error al obtener el producto"
        })
    }
}

module.exports = {
  getAllProducts,
  getProductsBySupplier,
  createProduct,
  updateProduct,
  deleteProduct,
  getRandomProduct
};
