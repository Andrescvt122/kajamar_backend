const suppliersController = require("../controllers/suppliers.controller");
const prisma = require("../prisma/prismaClient");

jest.mock("../prisma/prismaClient", () => ({
  categorias: {
    findMany: jest.fn(),
  },
  proveedores: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  proveedor_categoria: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
}));

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Suppliers controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("updateSupplier normaliza un nit numérico antes de actualizar", async () => {
    const req = {
      params: { id: "25" },
      body: {
        nombre: "Postobon editado",
        nit: 122345678901,
        telefono: "3456789091",
        direccion: "Calle 45 #45-09",
        estado: true,
        descripcion: null,
        tipo_persona: "Persona Jurídica",
        contacto: "Camilo Ortiz",
        correo: "camilo@gmail.com",
        categorias: [1],
      },
    };
    const res = mockResponse();

    prisma.proveedores.findUnique
      .mockResolvedValueOnce({ id_proveedor: 25 })
      .mockResolvedValueOnce({
        id_proveedor: 25,
        nombre: "Postobon editado",
        nit: "122345678901",
        proveedor_categoria: [],
      });
    prisma.proveedores.update.mockResolvedValue({});
    prisma.categorias.findMany.mockResolvedValue([{ id_categoria: 1 }]);
    prisma.proveedor_categoria.deleteMany.mockResolvedValue({});
    prisma.proveedor_categoria.createMany.mockResolvedValue({});

    await suppliersController.updateSupplier(req, res);

    expect(prisma.proveedores.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_proveedor: 25 },
        data: expect.objectContaining({
          nit: "122345678901",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("updateSupplier rechaza un nit inválido", async () => {
    const req = {
      params: { id: "25" },
      body: {
        nombre: "Proveedor inválido",
        nit: "ABC-123",
        telefono: "3456789091",
        direccion: "Calle 45 #45-09",
        estado: true,
        descripcion: null,
        tipo_persona: "Persona Jurídica",
        contacto: "Camilo Ortiz",
        correo: "camilo@gmail.com",
        categorias: [1],
      },
    };
    const res = mockResponse();

    prisma.proveedores.findUnique.mockResolvedValue({ id_proveedor: 25 });

    await suppliersController.updateSupplier(req, res);

    expect(prisma.proveedores.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "El NIT debe contener solo números y puede incluir puntos o guiones.",
      })
    );
  });
});
