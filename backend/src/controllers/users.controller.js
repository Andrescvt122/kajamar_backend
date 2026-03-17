// controllers/usersController.js
const prisma = require("../prisma/prismaClient");
const bcrypt = require("bcryptjs");
// 🟢 Obtener todos los usuarios (paginado)
const saltRounds = 10;
const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 6);
    const search = (req.query.search || "").trim();
    const skip = (page - 1) * limit;

    // Filtro de búsqueda sobre campos de usuario y email de acceso
    const where = search
      ? {
        OR: [
          { nombre: { contains: search, mode: "insensitive" } },
          { apellido: { contains: search, mode: "insensitive" } },
          { documento: { contains: search, mode: "insensitive" } },
          { telefono: { contains: search, mode: "insensitive" } },
          { acceso: { email: { contains: search, mode: "insensitive" } } },
        ],
      }
      : {};

    const include = {
      acceso: {
        select: {
          email: true,
          estado_usuario: true,
          roles: { select: { rol_nombre: true } },
        },
      },
    };

    const [total, users] = await Promise.all([
      prisma.usuarios.count({ where }),
      prisma.usuarios.findMany({ where, include, skip, take: limit, orderBy: { usuario_id: "asc" } }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const data = users.map((user) => ({
      id: user.usuario_id,
      Nombre: `${user.nombre} ${user.apellido || ""}`,
      Correo: user.acceso?.email || "N/A",
      Documento: user.documento,
      Telefono: user.telefono,
      Rol: user.acceso?.roles?.rol_nombre || "Sin Rol",
      Estado: user.acceso?.estado_usuario === true ? "Activo" : "Inactivo",
      _original: user,
    }));

    return res.status(200).json({ data, total, totalPages, page });
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return res.status(500).json({ error: "Error getting users" });
  }
};

// 🟢 Obtener usuario por ID
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

// 🟢 Crear usuario con correo, rol y estado
const createUser = async (req, res) => {
  const {
    nombre,
    apellido,
    telefono,
    documento,
    email,
    rol_id,
    estado_usuario = true, // por defecto activo
    password_hash,
  } = req.body;

  try {
    // Validar que el rol existe y su estado no impida crear un usuario activo
    const role = await prisma.roles.findUnique({
      where: { rol_id },
      select: { estado_rol: true },
    });

    if (!role) {
      return res.status(404).json({ error: "Rol no encontrado." });
    }

    if (role.estado_rol === false && estado_usuario === true) {
      return res.status(400).json({ error: "No se puede crear un usuario activo con un rol desactivado." });
    }

    const hashedPassword = await bcrypt.hash(password_hash, saltRounds);
    // 1️⃣ Crear acceso vinculado a un rol
    const nuevoAcceso = await prisma.acceso.create({
      data: {
        email,
        password_hash: hashedPassword,
        estado_usuario,
        rol_id,
      },
    });

    // 2️⃣ Crear usuario asociado al acceso
    const newUser = await prisma.usuarios.create({
      data: {
        nombre,
        apellido,
        telefono,
        documento,
        acceso_id: nuevoAcceso.acceso_id,
      },
      include: {
        acceso: {
          select: {
            email: true,
            estado_usuario: true,
            roles: { select: { rol_nombre: true } },
          },
        },
      },
    });

    return res.status(201).json({
      message: "Usuario creado correctamente",
      data: newUser,
    });
  } catch (error) {
    console.error("Error al crear usuario:", error);

    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "El email o documento ya están en uso." });
    }

    return res.status(500).json({ error: "Error al crear el usuario" });
  }
};

// 🟢 Actualizar usuario
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

// 🟢 Cambiar estado del usuario (Activo/Inactivo)
const toggleUserStatus = async (req, res) => {
  const usuario_id = Number(req.params.id);
  const { nuevoEstado } = req.body;

  if (typeof nuevoEstado !== "boolean") {
    return res
      .status(400)
      .json({ error: "nuevoEstado must be a boolean (true/false)." });
  }

  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { usuario_id },
      select: { 
        acceso_id: true,
        acceso: {
          select: {
            roles: {
              select: { estado_rol: true }
            }
          }
        }
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "User not found" });
    }

    if (nuevoEstado === true && usuario.acceso?.roles?.estado_rol === false) {
      return res.status(400).json({ error: "No se puede activar un usuario si su rol está desactivado." });
    }

    const updatedAcceso = await prisma.acceso.update({
      where: { acceso_id: usuario.acceso_id },
      data: {
        estado_usuario: nuevoEstado,
      },
    });

    return res.status(200).json({
      message: `Estado del usuario ${usuario_id} actualizado a ${nuevoEstado ? "Activo" : "Inactivo"
        }`,
      estado: updatedAcceso.estado_usuario,
    });
  } catch (error) {
    console.error("Error al cambiar estado del usuario:", error);
    return res
      .status(500)
      .json({ error: "Error actualizando el estado del usuario" });
  }
};

// 🟢 Eliminar usuario
const deleteUser = async (req, res) => {
  const usuario_id = Number(req.params.id);
  try {
    // 1️⃣ Buscar el usuario para obtener su acceso_id
    const user = await prisma.usuarios.findUnique({
      where: { usuario_id },
      select: { acceso_id: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found for deletion" });
    }

    // 2️⃣ Eliminar el registro de acceso (esto eliminará el usuario en cascada)
    await prisma.acceso.delete({
      where: { acceso_id: user.acceso_id },
    });

    return res.status(200).json({ message: "User and access deleted successfully" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "User or access not found for deletion" });
    }

    return res.status(500).json({ error: "Error deleting the user" });
  }
};

// 🟢 Exportar controladores
module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
};
