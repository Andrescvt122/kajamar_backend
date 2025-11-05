// controllers/usersController.js

const prisma = require("../prisma/prismaClient");

// ✅ GET /users - Obtiene todos los usuarios
const getUsers = async (req, res) => {
  try {
    const users = await prisma.usuarios.findMany({
      include: {
        acceso: {
          include: {
            roles: true, // Incluye el rol asociado
          },
        },
      },
    });
    return res.status(200).json(users);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return res.status(500).json({ error: "Error getting users" });
  }
};

// ✅ GET /users/:id - Obtiene un usuario por su ID
const getUserById = async (req, res) => {
  const usuario_id = Number(req.params.id);
  try {
    const user = await prisma.usuarios.findUnique({
      where: { usuario_id },
      include: {
        acceso: {
          include: {
            roles: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    return res.status(500).json({ error: "Error getting the user" });
  }
};

// ✅ POST /users - Crea un nuevo usuario
const createUser = async (req, res) => {
  const { acceso_id, nombre, apellido, telefono, documento } = req.body;
  try {
    const newUser = await prisma.usuarios.create({
      data: {
        acceso_id: Number(acceso_id),
        nombre,
        apellido,
        telefono,
        documento,
      },
    });

    return res.status(201).json({
      message: "User created successfully",
      data: newUser,
    });
  } catch (error) {
    console.error("Error al crear usuario:", error);

    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "The acceso_id or document is already in use." });
    }
    if (error.code === "P2003") {
      return res
        .status(400)
        .json({ error: "The provided acceso_id does not exist." });
    }

    return res.status(500).json({ error: "Error creating the user" });
  }
};

// ✅ PUT /users/:id - Actualiza un usuario
const updateUser = async (req, res) => {
  const usuario_id = Number(req.params.id);
  const { nombre, apellido, telefono, documento } = req.body;

  try {
    const updatedUser = await prisma.usuarios.update({
      where: { usuario_id },
      data: {
        nombre,
        apellido,
        telefono,
        documento,
      },
    });

    return res.status(200).json({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found for update" });
    }
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "The new document is already in use." });
    }

    return res.status(500).json({ error: "Error updating the user" });
  }
};

// ✅ DELETE /users/:id - Elimina un usuario
const deleteUser = async (req, res) => {
  const usuario_id = Number(req.params.id);
  try {
    await prisma.usuarios.delete({
      where: { usuario_id },
    });

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found for deletion" });
    }

    return res.status(500).json({ error: "Error deleting the user" });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
