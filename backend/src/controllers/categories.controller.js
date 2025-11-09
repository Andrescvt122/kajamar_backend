// controllers/categories.controller.js
const prisma = require("../prisma/prismaClient");

// ✅ Obtener todas las categorías
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.categorias.findMany({
      orderBy: { id_categoria: "desc" },
    });
    res.json(categories);
  } catch (error) {
    console.error("❌ Error al obtener categorías:", error);
    res.status(500).json({ error: "Error al obtener las categorías" });
  }
};

// ✅ Obtener una categoría por ID
const getCategoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const category = await prisma.categorias.findUnique({
      where: { id_categoria: Number(id) },
    });
    if (!category)
      return res.status(404).json({ error: "Categoría no encontrada" });
    res.json(category);
  } catch (error) {
    console.error("❌ Error al obtener la categoría:", error);
    res.status(500).json({ error: "Error al obtener la categoría" });
  }
};

// ✅ Crear nueva categoría
const createCategory = async (req, res) => {
  try {
    const { nombre_categoria, descripcion_categoria, estado } = req.body;

    const category = await prisma.categorias.create({
      data: {
        nombre_categoria,
        descripcion_categoria,
        estado: estado ?? true,
      },
    });

    res.status(201).json({
      message: "Categoría creada correctamente",
      category,
    });
  } catch (error) {
    console.error("❌ Error al crear categoría:", error);
    res.status(500).json({ error: "Error al crear la categoría" });
  }
};

// ✅ Actualizar categoría
const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { nombre_categoria, descripcion_categoria, estado } = req.body;

  try {
    const category = await prisma.categorias.update({
      where: { id_categoria: Number(id) },
      data: {
        nombre_categoria,
        descripcion_categoria,
        estado,
      },
    });

    res.json({
      message: "Categoría actualizada correctamente",
      category,
    });
  } catch (error) {
    console.error("❌ Error al actualizar categoría:", error);
    res.status(500).json({ error: "Error al actualizar la categoría" });
  }
};

// ✅ Eliminar categoría
const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.categorias.delete({
      where: { id_categoria: Number(id) },
    });

    res.json({ message: "Categoría eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar categoría:", error);
    res.status(500).json({ error: "Error al eliminar la categoría" });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
