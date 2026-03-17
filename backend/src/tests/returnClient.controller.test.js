jest.mock("../prisma/prismaClient", () => ({
  devolucion_cliente: { findMany: jest.fn() },
  ventas: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
}));

jest.mock("../controllers/returnProducts.controller", () => ({
  getResponsable: jest.fn(),
}));

const prisma = require("../prisma/prismaClient");
const { getResponsable } = require("../controllers/returnProducts.controller");
const {
  getReturnClients,
  createReturnClients,
  anularReturnClient,
} = require("../controllers/returnClient.controller");

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("returnClient.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getReturnClients", () => {
    test("debe limitar a 20 resultados máximo y devolver nextCursor", async () => {
      const req = { query: { limit: "50" } };
      const res = buildRes();

      const rows = Array.from({ length: 21 }, (_, i) => ({
        id_devoluciones_cliente: 100 - i,
      }));
      prisma.devolucion_cliente.findMany.mockResolvedValue(rows);

      await getReturnClients(req, res);

      expect(prisma.devolucion_cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 21,
          orderBy: { id_devoluciones_cliente: "desc" },
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: rows.slice(0, 20),
        meta: { limit: 20, nextCursor: rows[19].id_devoluciones_cliente },
      });
    });
    test("debe responder 500 cuando ocurre un error al listar devoluciones", async () => {
      const req = { query: {} };
      const res = buildRes();

      prisma.devolucion_cliente.findMany.mockRejectedValue(
        new Error("DB error"),
      );

      await getReturnClients(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Error al obtener las devoluciones a clientes",
      });
    });
  });

  describe("createReturnClients", () => {
    test("debe responder 404 cuando el responsable no existe", async () => {
      const req = { body: { id_responsable: 999 } };
      const res = buildRes();

      getResponsable.mockResolvedValue(null);

      await createReturnClients(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Responsable no encontrado",
      });
    });

    test("debe responder 400 cuando hay productos fuera de la venta", async () => {
      const req = {
        body: {
          id_responsable: 1,
          id_venta: 10,
          productosVenta: [{ id_detalle_venta: 999, cantidad: 1 }],
          productosEntrega: [
            { id_detalle_producto: 1, cantidad: 1, valor_unitario: 10 },
          ],
        },
      };
      const res = buildRes();

      getResponsable.mockResolvedValue({
        usuario_id: 1,
        nombre: "Ana",
        apellido: "Pérez",
      });
      prisma.ventas.findUnique.mockResolvedValue({
        id_venta: 10,
        detalle_venta: [{ id_detalle: 100 }],
      });

      await createReturnClients(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Uno o mas productos a devolver no existen en la venta",
      });
    });
    test("debe responder 404 cuando la venta no existe", async () => {
      const req = {
        body: {
          id_responsable: 1,
          id_venta: 999,
          productosVenta: [],
          productosEntrega: [],
        },
      };
      const res = buildRes();

      getResponsable.mockResolvedValue({
        usuario_id: 1,
        nombre: "Ana",
        apellido: "Pérez",
      });

      prisma.ventas.findUnique.mockResolvedValue(null);

      await createReturnClients(req, res);

      expect(prisma.ventas.findUnique).toHaveBeenCalledWith({
        where: { id_venta: 999 },
        include: { detalle_venta: true },
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Venta no encontrada o no existe",
      });
    });
    test("debe responder 400 cuando la venta no tiene disponible devoluciones", async () => {
      const req = {
        body: {
          id_responsable: 1,
          id_venta: 10,
          productosVenta: [{ id_detalle_venta: 100, cantidad: 1 }],
          productosEntrega: [
            { id_detalle_producto: 1, cantidad: 1, valor_unitario: 10 },
          ],
        },
      };
      const res = buildRes();

      getResponsable.mockResolvedValue({
        usuario_id: 1,
        nombre: "Ana",
        apellido: "Pérez",
      });

      prisma.ventas.findUnique.mockResolvedValue({
        id_venta: 10,
        detalle_venta: [{ id_detalle: 100 }],
      });

      prisma.ventas.findFirst.mockResolvedValue({
        dispo_devolucion: false,
      });

      await createReturnClients(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "La venta no tiene disponible devoluciones",
      });
    });
    test("debe responder 500 cuando ocurre un error al procesar la devolucion", async () => {
      const req = {
        body: {
          id_responsable: 1,
          id_venta: 10,
          total_devolucion_producto: 100,
          total_devolucion_cliente: 120,
          productosVenta: [
            {
              id_detalle_venta: 100,
              cantidad: 1,
              motivo: "incorrecto",
              valor_unitario: 100,
            },
          ],
          productosEntrega: [
            { id_detalle_producto: 1, cantidad: 1, valor_unitario: 120 },
          ],
        },
      };
      const res = buildRes();

      getResponsable.mockResolvedValue({
        usuario_id: 1,
        nombre: "Ana",
        apellido: "Pérez",
      });

      prisma.ventas.findUnique.mockResolvedValue({
        id_venta: 10,
        detalle_venta: [{ id_detalle: 100 }],
      });

      prisma.ventas.findFirst.mockResolvedValue({
        dispo_devolucion: true,
      });

      prisma.$transaction.mockRejectedValue(new Error("transaction error"));

      await createReturnClients(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Error al procesar la devolucion al cliente",
      });
    });
  });

  describe("anularReturnClient", () => {
    test("debe responder 400 cuando el id de devolución es inválido", async () => {
      const req = { params: { id: "abc" }, body: { id_responsable: 1 } };
      const res = buildRes();

      await anularReturnClient(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "ID de devolucion invalido",
      });
    });

    test("debe responder 404 cuando la devolución a anular no existe", async () => {
      const req = { params: { id: "22" }, body: { id_responsable: 1 } };
      const res = buildRes();

      getResponsable.mockResolvedValue({
        usuario_id: 1,
        nombre: "Ana",
        apellido: "Pérez",
      });

      prisma.$transaction.mockImplementation(async (cb) =>
        cb({
          devolucion_cliente: { findUnique: jest.fn().mockResolvedValue(null) },
        }),
      );

      await anularReturnClient(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Devolucion al cliente no encontrada",
      });
    });

    test("debe anular la devolución y responder 200", async () => {
      const req = { params: { id: "50" }, body: { id_responsable: 7 } };
      const res = buildRes();

      getResponsable.mockResolvedValue({
        usuario_id: 7,
        nombre: "Sara",
        apellido: "Ruiz",
      });

      const tx = {
        devolucion_cliente: {
          findUnique: jest.fn().mockResolvedValue({
            id_devoluciones_cliente: 50,
            id_venta: 15,
            estado: true,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        ventas: { update: jest.fn().mockResolvedValue({}) },
        devolucion_cliente_devuelto: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        devolucion_cliente_entregado: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        productos_baja: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn(),
        },
        detalle_productos_baja: { deleteMany: jest.fn() },
        detalle_productos: { update: jest.fn() },
        productos: { update: jest.fn() },
      };

      prisma.$transaction.mockImplementation(async (cb) => cb(tx));

      await anularReturnClient(req, res);

      expect(tx.devolucion_cliente.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_devoluciones_cliente: 50 } }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Devolucion al cliente anulada con exito",
      });
    });
    test("debe responder 404 cuando el responsable no existe", async () => {
      const req = { params: { id: "22" }, body: { id_responsable: 999 } };
      const res = buildRes();

      getResponsable.mockResolvedValue(null);

      await anularReturnClient(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Responsable no encontrado",
      });
    });
    test("debe responder 400 cuando la devolucion ya esta anulada", async () => {
      const req = { params: { id: "22" }, body: { id_responsable: 1 } };
      const res = buildRes();

      getResponsable.mockResolvedValue({
        usuario_id: 1,
        nombre: "Ana",
        apellido: "Pérez",
      });

      prisma.$transaction.mockImplementation(async (cb) =>
        cb({
          devolucion_cliente: {
            findUnique: jest.fn().mockResolvedValue({
              id_devoluciones_cliente: 22,
              id_venta: 5,
              estado: false,
            }),
          },
        }),
      );

      await anularReturnClient(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "La devolucion al cliente ya esta anulada",
      });
    });
    test("debe responder 500 cuando ocurre un error al anular la devolucion", async () => {
      const req = { params: { id: "50" }, body: { id_responsable: 7 } };
      const res = buildRes();

      getResponsable.mockResolvedValue({
        usuario_id: 7,
        nombre: "Sara",
        apellido: "Ruiz",
      });

      prisma.$transaction.mockRejectedValue(new Error("transaction error"));

      await anularReturnClient(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Error al anular la devolucion al cliente",
      });
    });
  });
});
