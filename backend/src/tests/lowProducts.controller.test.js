jest.mock("../prisma/prismaClient", () => ({
  $transaction: jest.fn(),
}));

jest.mock("../utils/cloudinaryUpload", () => ({
  safeUnlink: jest.fn(),
}));

jest.mock("../utils/productImageUpload", () => ({
  uploadProductImageWithBgRemoval: jest.fn(),
}));

jest.mock("../utils/detailBarcode", () => ({
  assertDetailBarcodeAvailable: jest.fn(),
  isDetailBarcodeUniqueConstraintError: jest.fn(() => false),
  isDetailBarcodeValidationError: jest.fn(() => false),
}));

const prisma = require("../prisma/prismaClient");
const {
  cancelLowProduct,
} = require("../controllers/lowProducts.controller");

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildSuccessfulTx = (baja) => ({
  productos_baja: {
    findUnique: jest
      .fn()
      .mockResolvedValueOnce(baja)
      .mockResolvedValueOnce({ ...baja }),
    update: jest.fn().mockResolvedValue({}),
  },
  detalle_productos_baja: {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  conversion_productos: {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  detalle_conversion_productos: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  detalle_productos: {
    findMany: jest.fn().mockResolvedValue([
      {
        id_detalle_producto: 5,
        id_producto: 9,
        stock_producto: 0,
      },
    ]),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  productos: {
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  detalle_venta: {
    findMany: jest.fn().mockResolvedValue([]),
  },
});

describe("lowProducts.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("permite anular una baja reciente cuando created_at es válido", async () => {
    const req = { params: { id: "25" } };
    const res = buildRes();
    const baja = {
      id_baja_productos: 25,
      estado: true,
      created_at: new Date(Date.now() - 5 * 60 * 1000),
      fecha_baja: new Date("2026-03-30T12:00:00.000Z"),
      detalle_productos_baja: [
        {
          id_detalle_productos: 5,
          cantidad: 2,
        },
      ],
      conversionProductos: [],
    };

    const tx = buildSuccessfulTx(baja);
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    await cancelLowProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(tx.productos_baja.update).toHaveBeenCalledWith({
      where: { id_baja_productos: 25 },
      data: { estado: false },
    });
  });

  test("no bloquea la anulación por una fecha sin hora cuando created_at viene nulo", async () => {
    const req = { params: { id: "26" } };
    const res = buildRes();
    const baja = {
      id_baja_productos: 26,
      estado: true,
      created_at: null,
      fecha_baja: "2026-03-30",
      detalle_productos_baja: [
        {
          id_detalle_productos: 5,
          cantidad: 1,
        },
      ],
      conversionProductos: [],
    };

    const tx = buildSuccessfulTx(baja);
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    await cancelLowProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("No se puede anular"),
      })
    );
  });

  test("rechaza la anulación cuando ya pasaron más de 30 minutos", async () => {
    const req = { params: { id: "27" } };
    const res = buildRes();
    const baja = {
      id_baja_productos: 27,
      estado: true,
      created_at: new Date(Date.now() - 31 * 60 * 1000),
      detalle_productos_baja: [],
    };

    prisma.$transaction.mockImplementation((callback) =>
      callback({
        productos_baja: {
          findUnique: jest.fn().mockResolvedValue(baja),
        },
      })
    );

    await cancelLowProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("han pasado 31 minutos"),
      })
    );
  });
});
