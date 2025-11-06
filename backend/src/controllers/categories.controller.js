const prisma = require("../prisma/prismaClient");

// ✅ Obtener todas las categorías
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.categorias.findMany({
      orderBy: { id_categoria: "asc" },
    });
    return res.status(200).json(categories);
  } catch (error) {
    console.error("❌ Error al obtener las categorías:", error);
    return res.status(500).json({ error: "Error al obtener las categorías" });
  }
};

// ✅ Obtener una categoría por ID
const getCategoryById = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const category = await prisma.categorias.findUnique({
      where: { id_categoria: id },
    });

    if (!category) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    return res.status(200).json(category);
  } catch (error) {
    console.error("❌ Error al obtener la categoría:", error);
    return res.status(500).json({ error: "Error al obtener la categoría" });
  }
};

// ✅ Crear una nueva categoría
const createCategory = async (req, res) => {
  const { nombre_categoria, descripcion_categoria, estado } = req.body;

  if (!nombre_categoria || descripcion_categoria === undefined || estado === undefined) {
    return res.status(400).json({
      error: "Faltan datos requeridos: nombre_categoria, descripcion_categoria o estado",
    });
  }

  try {
    const category = await prisma.categorias.create({
      data: {
        nombre_categoria,
        descripcion_categoria,
        estado,
      },
    });

    return res.status(201).json({
      message: "✅ Categoría creada correctamente",
      category,
    });
  } catch (error) {
    console.error("❌ Error al crear la categoría:", error);
    return res.status(500).json({ error: "Error al crear la categoría" });
  }
};

// ✅ Actualizar una categoría existente
const updateCategory = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre_categoria, descripcion_categoria, estado } = req.body;

  try {
    const existing = await prisma.categorias.findUnique({
      where: { id_categoria: id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    const updated = await prisma.categorias.update({
      where: { id_categoria: id },
      data: {
        nombre_categoria: nombre_categoria ?? existing.nombre_categoria,
        descripcion_categoria: descripcion_categoria ?? existing.descripcion_categoria,
        estado: estado ?? existing.estado,
      },
    });

    return res.status(200).json({
      message: "✅ Categoría actualizada correctamente",
      category: updated,
    });
  } catch (error) {
    console.error("❌ Error al actualizar la categoría:", error);
    return res.status(500).json({ error: "Error al actualizar la categoría" });
  }
};

// ✅ Eliminar una categoría
const deleteCategory = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const existing = await prisma.categorias.findUnique({
      where: { id_categoria: id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    await prisma.categorias.delete({
      where: { id_categoria: id },
    });

    return res.status(200).json({ message: "✅ Categoría eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar la categoría:", error);
    return res.status(500).json({ error: "Error al eliminar la categoría" });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
