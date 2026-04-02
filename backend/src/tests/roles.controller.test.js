const rolesController = require("../controllers/roles.controller");
const prisma = require("../prisma/prismaClient");

jest.mock("../prisma/prismaClient", () => ({
roles: {
count: jest.fn(),
findMany: jest.fn(),
findUnique: jest.fn(),
create: jest.fn(),
update: jest.fn(),
delete: jest.fn()
},
rol_permisos: {
deleteMany: jest.fn(),
createMany: jest.fn()
},
acceso: {
count: jest.fn(),
updateMany: jest.fn()
},
$transaction: jest.fn(async (callback) => {
return callback({
rol_permisos: {
deleteMany: jest.fn(),
createMany: jest.fn()
},
roles: {
update: jest.fn()
},
acceso: {
updateMany: jest.fn()
}
});
})
}));

const mockResponse = () => {
const res = {};
res.status = jest.fn().mockReturnValue(res);
res.json = jest.fn().mockReturnValue(res);
return res;
};

describe("Testing módulo de Roles", () => {

beforeEach(() => {
jest.clearAllMocks();
});

test("Listar roles correctamente", async () => {
const req = { query: { page: "1", limit: "6", search: "" } };
const res = mockResponse();


prisma.roles.count.mockResolvedValue(2);
prisma.roles.findMany.mockResolvedValue([
  { rol_id: 1, rol_nombre: "Admin" },
  { rol_id: 2, rol_nombre: "Empleado" }
]);

await rolesController.getRoles(req, res);

expect(res.status).toHaveBeenCalledWith(200);


});

test("Error al listar roles", async () => {
const req = { query: {} };
const res = mockResponse();


prisma.roles.count.mockRejectedValue(new Error("DB error"));

await rolesController.getRoles(req, res);

expect(res.status).toHaveBeenCalledWith(500);


});

test("Obtener rol por ID correctamente", async () => {
const req = { params: { id: "1" } };
const res = mockResponse();


prisma.roles.findUnique.mockResolvedValue({
  rol_id: 1,
  rol_nombre: "Administrador"
});

await rolesController.getRoleById(req, res);

expect(res.status).toHaveBeenCalledWith(200);


});

test("ID inválido al consultar rol", async () => {
const req = { params: { id: "abc" } };
const res = mockResponse();


await rolesController.getRoleById(req, res);

expect(res.status).toHaveBeenCalledWith(400);


});

test("Rol no encontrado", async () => {
const req = { params: { id: "999" } };
const res = mockResponse();


prisma.roles.findUnique.mockResolvedValue(null);

await rolesController.getRoleById(req, res);

expect(res.status).toHaveBeenCalledWith(404);


});

test("Crear rol correctamente", async () => {
const req = {
body: {
rol_nombre: "Administrador",
descripcion: "Control total",
permisosIds: [1,2]
}
};
const res = mockResponse();


prisma.roles.findUnique.mockResolvedValue(null);
prisma.roles.create.mockResolvedValue({
  rol_id: 1,
  rol_nombre: "Administrador"
});

await rolesController.createRole(req, res);

expect(res.status).toHaveBeenCalledWith(201);


});

test("Crear rol sin nombre", async () => {
const req = { body: { rol_nombre: "" } };
const res = mockResponse();


await rolesController.createRole(req, res);

expect(res.status).toHaveBeenCalledWith(400);


});

test("Crear rol duplicado", async () => {
const req = {
body: {
rol_nombre: "Administrador"
}
};
const res = mockResponse();


prisma.roles.findUnique.mockResolvedValue({
  rol_id: 1
});

await rolesController.createRole(req, res);

expect(res.status).toHaveBeenCalledWith(409);


});

test("Error al crear rol por clave foránea", async () => {
const req = {
body: {
rol_nombre: "Editor",
permisosIds: [99]
}
};
const res = mockResponse();


prisma.roles.findUnique.mockResolvedValue(null);
prisma.roles.create.mockRejectedValue({ code: "P2003" });

await rolesController.createRole(req, res);

expect(res.status).toHaveBeenCalledWith(400);


});

test("Actualizar rol correctamente", async () => {
const req = {
params: { id: "1" },
body: {
rol_nombre: "Admin",
descripcion: "Actualizado",
estado_rol: true,
permisosIds: [1,2]
}
};


const res = mockResponse();

prisma.roles.findUnique.mockResolvedValue(null);
prisma.roles.findUnique.mockResolvedValueOnce({
  rol_id: 1,
  rol_nombre: "Admin"
});

await rolesController.updateRole(req, res);

expect(res.status).toHaveBeenCalledWith(200);


});

test("Actualizar rol con ID inválido", async () => {
const req = {
params: { id: "abc" },
body: {}
};


const res = mockResponse();

await rolesController.updateRole(req, res);

expect(res.status).toHaveBeenCalledWith(400);


});

test("Error de rol no encontrado al actualizar", async () => {
const req = {
params: { id: "5" },
body: { rol_nombre: "Admin" }
};


const res = mockResponse();

prisma.roles.findUnique.mockResolvedValue(null);
prisma.$transaction.mockRejectedValue({ code: "P2025" });

await rolesController.updateRole(req, res);

expect(res.status).toHaveBeenCalledWith(404);


});

test("Eliminar rol correctamente", async () => {
const req = { params: { id: "5" } };
const res = mockResponse();


prisma.acceso.count.mockResolvedValue(0);
prisma.roles.delete.mockResolvedValue({});

await rolesController.deleteRole(req, res);

expect(res.status).toHaveBeenCalledWith(200);


});

test("Eliminar rol en uso", async () => {
const req = { params: { id: "5" } };
const res = mockResponse();


prisma.acceso.count.mockResolvedValue(2);

await rolesController.deleteRole(req, res);

expect(res.status).toHaveBeenCalledWith(409);


});

test("Eliminar rol inexistente", async () => {
const req = { params: { id: "5" } };
const res = mockResponse();


prisma.acceso.count.mockResolvedValue(0);
prisma.roles.delete.mockRejectedValue({ code: "P2025" });

await rolesController.deleteRole(req, res);

expect(res.status).toHaveBeenCalledWith(404);


});

});
