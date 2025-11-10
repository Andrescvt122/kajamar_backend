// controllers/usersController.js

const prisma = require("../prisma/prismaClient");

const getUsers = async (req, res) => {
  try {
    const users = await prisma.usuarios.findMany({
      include: {
        acceso: {
          select: { 
            email: true,             
            estado_usuario: true,    
            roles: {
              select: {
                rol_nombre: true,    
              },
            },
          },
        },
      },
    });

    const normalizedUsers = users.map(user => {
      const NombreCompleto = `${user.nombre} ${user.apellido || ''}`;
      const Correo = user.acceso?.email || 'N/A';
      const Rol = user.acceso?.roles?.rol_nombre || 'Sin Rol';
      const EstadoUsuario = user.acceso?.estado_usuario === true ? "Activo" : "Inactivo"; 

      return {
        id: user.usuario_id,                   
        Nombre: NombreCompleto,              
        Correo: Correo,                        
        Documento: user.documento,     
        Telefono: user.telefono,       
        Rol: Rol,                      
        Estado: EstadoUsuario,         
        
        _original: user, 
      };
    });
    
    return res.status(200).json(normalizedUsers);

  } catch (error) {
    console.error("Error al obtener usuarios:", error); 
    return res.status(500).json({ error: "Error getting users" });
  }
};

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

const createUser = async (req, res) => {
  const { nombre, apellido, telefono, documento } = req.body;
  try {
    const newUser = await prisma.usuarios.create({
      data: {
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

const toggleUserStatus = async (req, res) => {
    const usuario_id = Number(req.params.id);
    const { nuevoEstado } = req.body; // Esperamos { nuevoEstado: true/false }

    if (typeof nuevoEstado !== 'boolean') {
        return res.status(400).json({ error: "nuevoEstado must be a boolean (true/false)." });
    }

    try {
        const usuario = await prisma.usuarios.findUnique({
            where: { usuario_id },
            select: { acceso_id: true }
        });

        if (!usuario) {
            return res.status(404).json({ error: "User not found" });
        }

        const updatedAcceso = await prisma.acceso.update({
            where: { acceso_id: usuario.acceso_id },
            data: {
                estado_usuario: nuevoEstado,
            },
        });

        return res.status(200).json({
            message: `Estado del usuario ${usuario_id} actualizado a ${nuevoEstado ? 'Activo' : 'Inactivo'}`,
            estado: updatedAcceso.estado_usuario,
        });

    } catch (error) {
        console.error("Error al cambiar estado del usuario:", error);
        return res.status(500).json({ error: "Error actualizando el estado del usuario" });
    }
};


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
  toggleUserStatus,
};