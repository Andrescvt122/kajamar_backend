const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const modulos = [
    "Gestión Roles",
    "Gestión Usuarios",
    "Gestión Productos",
    "Gestión Categorías",
    "Gestión Proveedores",
  ];

  const acciones = ["Ver", "Crear", "Editar", "Eliminar"];

  for (const modulo of modulos) {
    for (const accion of acciones) {
      const permiso_nombre = `${accion} ${modulo}`;

      // Evitar duplicados si ya existen
      const existe = await prisma.permisos.findFirst({
        where: { permiso_nombre },
      });

      if (!existe) {
        await prisma.permisos.create({
          data: {
            modulo,
            permiso_nombre,
          },
        });
        console.log(`✅ Creado permiso: ${permiso_nombre}`);
      } else {
        console.log(`⚠️ Ya existe: ${permiso_nombre}`);
      }
    }
  }

  console.log("🎉 Todos los permisos han sido creados correctamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
