const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Crear instancia de Prisma
const prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'info' },
      { emit: 'stdout', level: 'warn' },
    ],
  });
  

// Solo registrar logs en modo desarrollo
if (process.env.NODE_ENV === 'development') {
  // Ruta absoluta hacia la carpeta /logs en la raíz del proyecto
    const logFile = "./logs/query.log";

  // Crear carpeta logs si no existe
  if (!fs.existsSync(logFile)) {
    fs.mkdirSync(logFile, { recursive: true });
  }

  // Escuchar todas las consultas ejecutadas por Prisma
  prisma.$on('query', (e) => {
    const log = `
[${new Date().toISOString()}]
Query: ${e.query}
Params: ${e.params}
Duration: ${e.duration} ms
----------------------------------------------
`;
    fs.appendFileSync(logFile, log);
  });
  
  console.log('📝 Prisma query logging habilitado (modo desarrollo).');
}else{
    console.log('📝 Prisma query logging deshabilitado (modo producción)');
}

// Exportar la instancia para usar en toda la app
module.exports = prisma;
