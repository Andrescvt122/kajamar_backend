const prisma = require("../prisma/prismaClient");

// ✅ Obtener todos los proveedores con sus categorías
exports.getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.proveedores.findMany({
      orderBy: { nombre: "asc" },
      include: {
        proveedor_categoria: {
          include: { categorias: true },
        },
      },
    });

    const formatted = suppliers.map((s) => ({
      ...s,
      categorias: s.proveedor_categoria.map((pc) => pc.categorias),
    }));

    res.json(formatted);
  } catch (error) {
    console.error("❌ Error al obtener proveedores:", error);
    res.status(500).json({ message: "Error al obtener los proveedores." });
  }
};
// ... arriba ya tienes: const prisma = require("../prisma/prismaClient");

// Detalle de proveedor: info básica + categorías + productos suministrados
exports.getSupplierDetail = async (req, res) => {
  const { id } = req.params;

  try {
    const supplier = await prisma.proveedores.findUnique({
      where: { id_proveedor: Number(id) },
      include: {
        // categorías asignadas al proveedor
        proveedor_categoria: {
          include: {
            categorias: {
              select: {
                id_categoria: true,
                nombre_categoria: true,
                descripcion_categoria: true,
                estado: true,
              },
            },
          },
        },
        // productos asociados mediante la tabla puente
        producto_proveedor: {
          include: {
            productos: {
              include: {
                categorias: { select: { id_categoria: true, nombre_categoria: true } },
              },
            },
          },
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    // Normalizar categorías (renombramos nombre_categoria -> nombre para facilitar el frontend)
    const categorias = supplier.proveedor_categoria.map((pc) => ({
      id_categoria: pc.categorias.id_categoria,
      nombre: pc.categorias.nombre_categoria,
      descripcion: pc.categorias.descripcion_categoria,
      estado: pc.categorias.estado,
    }));

    // Normalizar productos (dejamos 'categoria', 'precio', 'stock' listos para tu modal)
    const productos = supplier.producto_proveedor.map((pp) => {
      const p = pp.productos;
      return {
        id_producto: p.id_producto,
        nombre: p.nombre,
        categoria: p.categorias?.nombre_categoria || null,
        costo_unitario: p.costo_unitario,
        precio: p.precio_venta,         // tu modal usa 'precio'
        precio_venta: p.precio_venta,   // por si luego lo quieres
        stock: p.stock_actual,          // tu modal usa 'stock'
        stock_actual: p.stock_actual,   // por si luego lo quieres
        url_imagen: p.url_imagen || null,
        estado: p.estado,
      };
    });

    // Armar respuesta final
    const detail = {
      id_proveedor: supplier.id_proveedor,
      nombre: supplier.nombre,
      nit: supplier.nit,
      telefono: supplier.telefono,
      correo: supplier.correo,
      direccion: supplier.direccion,
      estado: supplier.estado,
      tipo_persona: supplier.tipo_persona || null,
      contacto: supplier.contacto || null,
      max_porcentaje_de_devolucion: supplier.max_porcentaje_de_devolucion,
      categorias,
      productos,
    };

    res.json(detail);
  } catch (error) {
    console.error("❌ Error al obtener detalle del proveedor:", error);
    res.status(500).json({ message: "Error al obtener el detalle del proveedor." });
  }
};

// Obtener un proveedor por ID
exports.getSupplierById = async (req, res) => {
  const { id } = req.params;
  try {
    const supplier = await prisma.proveedores.findUnique({
      where: { id_proveedor: parseInt(id) },
      include: {
        proveedor_categoria: {
          include: {
            categorias: {
              select: {
                id_categoria: true,
                nombre_categoria: true,
                descripcion_categoria: true,
                estado: true,
              },
            },
          },
        },
      },
    });

    if (!supplier)
      return res.status(404).json({ message: "Proveedor no encontrado." });

    const formatted = {
      ...supplier,
      categorias: supplier.proveedor_categoria.map((pc) => pc.categorias),
    };

    res.status(200).json(formatted);
  } catch (error) {
    console.error("❌ Error al obtener proveedor:", error);
    res.status(500).json({ message: "Error al obtener el proveedor." });
  }
};

// ✅ Crear proveedor con campos extendidos e IDs de categorías
exports.createSupplier = async (req, res) => {
  const {
    nombre,
    nit,
    telefono,
    direccion,
    estado,
    descripcion,
    tipo_persona,
    contacto,
    correo,
    max_porcentaje_de_devolucion,
    categorias = [],
  } = req.body;

  try {
    // Verificar categorías válidas
    const existingCats = await prisma.categorias.findMany({
      where: { id_categoria: { in: categorias } },
      select: { id_categoria: true },
    });

    if (categorias.length > 0 && existingCats.length === 0) {
      return res
        .status(400)
        .json({ message: "Las categorías indicadas no existen." });
    }

    // Crear proveedor
    const newSupplier = await prisma.proveedores.create({
      data: {
        nombre,
        nit: parseInt(nit),
        telefono,
        direccion,
        estado: estado ?? true,
        descripcion,
        tipo_persona,
        contacto,
        correo,
        max_porcentaje_de_devolucion: max_porcentaje_de_devolucion
          ? parseFloat(max_porcentaje_de_devolucion)
          : null,
        proveedor_categoria: {
          createMany: {
            data: existingCats.map((cat) => ({
              id_categoria: cat.id_categoria,
            })),
          },
        },
      },
      include: {
        proveedor_categoria: {
          include: { categorias: true },
        },
      },
    });

    const formatted = {
      ...newSupplier,
      categorias: newSupplier.proveedor_categoria.map((pc) => pc.categorias),
    };

    res.status(201).json(formatted);
  } catch (error) {
    console.error("❌ Error al crear proveedor:", error);
    res.status(500).json({ message: "Error al crear el proveedor." });
  }
};

// ✅ Actualizar proveedor con campos extendidos e IDs de categorías
exports.updateSupplier = async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    nit,
    telefono,
    direccion,
    estado,
    descripcion,
    tipo_persona,
    contacto,
    correo,
    max_porcentaje_de_devolucion,
    categorias = [],
  } = req.body;

  try {
    const existing = await prisma.proveedores.findUnique({
      where: { id_proveedor: parseInt(id) },
    });

    if (!existing)
      return res.status(404).json({ message: "Proveedor no encontrado." });

    // Actualiza proveedor
    await prisma.proveedores.update({
      where: { id_proveedor: parseInt(id) },
      data: {
        nombre,
        nit: parseInt(nit),
        telefono,
        direccion,
        estado,
        descripcion,
        tipo_persona,
        contacto,
        correo,
        max_porcentaje_de_devolucion: max_porcentaje_de_devolucion
          ? parseFloat(max_porcentaje_de_devolucion)
          : null,
      },
    });

    // Actualiza categorías
    await prisma.proveedor_categoria.deleteMany({
      where: { id_proveedor: parseInt(id) },
    });

    if (categorias.length > 0) {
      const existingCats = await prisma.categorias.findMany({
        where: { id_categoria: { in: categorias } },
        select: { id_categoria: true },
      });

      await prisma.proveedor_categoria.createMany({
        data: existingCats.map((cat) => ({
          id_proveedor: parseInt(id),
          id_categoria: cat.id_categoria,
        })),
      });
    }

    // Retornar con categorías actualizadas
    const supplierWithCats = await prisma.proveedores.findUnique({
      where: { id_proveedor: parseInt(id) },
      include: {
        proveedor_categoria: {
          include: { categorias: true },
        },
      },
    });

    const formatted = {
      ...supplierWithCats,
      categorias: supplierWithCats.proveedor_categoria.map((pc) => pc.categorias),
    };

    res.status(200).json(formatted);
  } catch (error) {
    console.error("❌ Error al actualizar proveedor:", error);
    res.status(500).json({ message: "Error al actualizar el proveedor." });
  }
};

// ✅ Eliminar proveedor
exports.deleteSupplier = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.proveedores.findUnique({
      where: { id_proveedor: parseInt(id) },
    });

    if (!existing)
      return res.status(404).json({ message: "Proveedor no encontrado." });

    await prisma.proveedor_categoria.deleteMany({
      where: { id_proveedor: parseInt(id) },
    });

    await prisma.proveedores.delete({
      where: { id_proveedor: parseInt(id) },
    });

    res.status(200).json({ message: "✅ Proveedor eliminado correctamente." });
  } catch (error) {
    console.error("❌ Error al eliminar proveedor:", error);
    res.status(500).json({ message: "Error al eliminar el proveedor." });
  }
};
