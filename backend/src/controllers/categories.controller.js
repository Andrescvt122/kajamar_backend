const prisma = require("../prisma/prismaClient");

// ✅ Obtener todas las categorías
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.categorias.findMany({
      orderBy: { id_categoria: "asc" },
      select: {
        id_categoria: true,
        nombre_categoria: true,
        descripcion_categoria: true,
        estado: true,
      },
    });

    return res.status(200).json(categories);
  } catch (error) {
    console.error("❌ Error al obtener las categorías:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener las categorías." });
  }
};

// ✅ Obtener una categoría por ID
const getCategoryById = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id))
    return res.status(400).json({ message: "ID de categoría inválido." });

  try {
    const category = await prisma.categorias.findUnique({
      where: { id_categoria: id },
      select: {
        id_categoria: true,
        nombre_categoria: true,
        descripcion_categoria: true,
        estado: true,
      },
    });

    if (!category)
      return res.status(404).json({ message: "Categoría no encontrada." });

    return res.status(200).json(category);
  } catch (error) {
    console.error("❌ Error al obtener la categoría:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener la categoría." });
  }
};

// ✅ Crear una nueva categoría
const createCategory = async (req, res) => {
  let { nombre_categoria, descripcion_categoria, estado } = req.body;

  if (!nombre_categoria)
    return res.status(400).json({
      message: "El campo 'nombre_categoria' es obligatorio.",
    });

  // Valores por defecto
  if (estado === undefined || estado === null) estado = true;
  if (descripcion_categoria === undefined) descripcion_categoria = "";

  try {
    // Verificar duplicados
    const existing = await prisma.categorias.findFirst({
      where: { nombre_categoria: { equals: nombre_categoria, mode: "insensitive" } },
    });
    if (existing)
      return res.status(409).json({
        message: "Ya existe una categoría con ese nombre.",
      });

    const newCategory = await prisma.categorias.create({
      data: {
        nombre_categoria,
        descripcion_categoria,
        estado: Boolean(estado),
      },
    });

    return res.status(201).json({
      message: "✅ Categoría creada correctamente.",
      category: newCategory,
    });
  } catch (error) {
    console.error("❌ Error al crear la categoría:", error);
    return res.status(500).json({ message: "Error al crear la categoría." });
  }
};

// ✅ Actualizar una categoría existente
const updateCategory = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id))
    return res.status(400).json({ message: "ID de categoría inválido." });

  const { nombre_categoria, descripcion_categoria, estado } = req.body;

  try {
    const existing = await prisma.categorias.findUnique({
      where: { id_categoria: id },
    });

    if (!existing)
      return res.status(404).json({ message: "Categoría no encontrada." });

    // Evitar duplicados al actualizar
    if (nombre_categoria && nombre_categoria !== existing.nombre_categoria) {
      const duplicate = await prisma.categorias.findFirst({
        where: {
          nombre_categoria: { equals: nombre_categoria, mode: "insensitive" },
          NOT: { id_categoria: id },
        },
      });
      if (duplicate)
        return res.status(409).json({
          message: "Ya existe otra categoría con ese nombre.",
        });
    }

    const updated = await prisma.categorias.update({
      where: { id_categoria: id },
      data: {
        nombre_categoria: nombre_categoria ?? existing.nombre_categoria,
        descripcion_categoria:
          descripcion_categoria ?? existing.descripcion_categoria,
        estado:
          estado === undefined || estado === null
            ? existing.estado
            : Boolean(estado),
      },
    });

    return res.status(200).json({
      message: "✅ Categoría actualizada correctamente.",
      category: updated,
    });
  } catch (error) {
    console.error("❌ Error al actualizar la categoría:", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar la categoría." });
  }
};

// ✅ Eliminar una categoría
const deleteCategory = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id))
    return res.status(400).json({ message: "ID de categoría inválido." });

  try {
    const existing = await prisma.categorias.findUnique({
      where: { id_categoria: id },
    });

    if (!existing)
      return res.status(404).json({ message: "Categoría no encontrada." });

    await prisma.categorias.delete({
      where: { id_categoria: id },
    });

    return res
      .status(200)
      .json({ message: "✅ Categoría eliminada correctamente." });
  } catch (error) {
    console.error("❌ Error al eliminar la categoría:", error);
    return res
      .status(500)
      .json({ message: "Error al eliminar la categoría." });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
