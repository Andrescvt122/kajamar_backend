const mockTx = {
  compras: {
    create: jest.fn(),
  },
  productos: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  producto_proveedor: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  detalle_productos: {
    create: jest.fn(),
    update: jest.fn(),
  },
  detalle_compra: {
    create: jest.fn(),
  },
};

const mockPrisma = {
  compras: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockSafeUnlink = jest.fn();
const mockUploadImageFileToCloudinary = jest.fn();
const mockAssertDetailBarcodeAvailable = jest.fn();

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock("../utils/cloudinaryUpload", () => ({
  safeUnlink: mockSafeUnlink,
  uploadImageFileToCloudinary: mockUploadImageFileToCloudinary,
}));

jest.mock("../utils/detailBarcode", () => ({
  assertDetailBarcodeAvailable: mockAssertDetailBarcodeAvailable,
  isDetailBarcodeUniqueConstraintError: jest.fn(() => false),
  isDetailBarcodeValidationError: jest.fn(() => false),
}));

jest.mock("../utils/dateTime", () => ({
  parseTimestampValue: jest.fn(() => null),
}));

const purchaseController = require("../controllers/purchase.controller");

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildRequest = () => ({
  body: {
    fecha_compra: "2026-04-04",
    numero_factura: "FAC-001",
    id_proveedor: 12,
    items: [
      {
        id_producto: 7,
        cantidad: 2,
        cantidad_paquetes: 2,
        unidades_por_paquete: 6,
        cantidad_total_unidades: 12,
        precio_unitario: 1000,
        precio_venta: 1500,
        iva_porcentaje: 19,
        icu_porcentaje: 0,
        paquetes: [
          {
            codigoBarrasIngreso: "770100000001",
            fechaVencimiento: "2026-06-01",
          },
          {
            codigoBarrasIngreso: "770100000002",
            fechaVencimiento: "2026-06-15",
          },
        ],
      },
    ],
  },
  file: undefined,
});

describe("purchase.controller createPurchase", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma.compras.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));

    mockTx.compras.create.mockResolvedValue({ id_compra: 99, numero_factura: "FAC-001" });
    mockTx.productos.update.mockResolvedValue({});
    mockTx.detalle_productos.create.mockResolvedValue({ id_detalle_producto: 501 });
    mockTx.detalle_productos.update.mockResolvedValue({});
    mockTx.detalle_compra.create.mockResolvedValue({});

    mockAssertDetailBarcodeAvailable.mockImplementation(async (_tx, barcode) => barcode);
  });

  test("crea la relacion producto_proveedor al registrar la compra", async () => {
    mockTx.productos.findUnique
      .mockResolvedValueOnce({ id_producto: 7 })
      .mockResolvedValueOnce({ precio_venta: 1200 });
    mockTx.producto_proveedor.findFirst.mockResolvedValue(null);
    mockTx.producto_proveedor.create.mockResolvedValue({ id_producto_proveedor: 301 });

    const req = buildRequest();
    const res = mockResponse();

    await purchaseController.createPurchase(req, res);

    expect(mockTx.producto_proveedor.findFirst).toHaveBeenCalledWith({
      where: {
        id_proveedor: 12,
        id_producto: 7,
      },
      select: {
        id_producto_proveedor: true,
        estado_producto_proveedor: true,
      },
    });
    expect(mockTx.producto_proveedor.create).toHaveBeenCalledWith({
      data: {
        id_proveedor: 12,
        id_producto: 7,
        estado_producto_proveedor: true,
      },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("reactiva la relacion producto_proveedor si ya existia inactiva", async () => {
    mockTx.productos.findUnique
      .mockResolvedValueOnce({ id_producto: 7 })
      .mockResolvedValueOnce({ precio_venta: 1200 });
    mockTx.producto_proveedor.findFirst.mockResolvedValue({
      id_producto_proveedor: 44,
      estado_producto_proveedor: false,
    });
    mockTx.producto_proveedor.update.mockResolvedValue({
      id_producto_proveedor: 44,
      estado_producto_proveedor: true,
    });

    const req = buildRequest();
    const res = mockResponse();

    await purchaseController.createPurchase(req, res);

    expect(mockTx.producto_proveedor.create).not.toHaveBeenCalled();
    expect(mockTx.producto_proveedor.update).toHaveBeenCalledWith({
      where: { id_producto_proveedor: 44 },
      data: { estado_producto_proveedor: true },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
