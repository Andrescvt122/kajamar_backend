const prisma = require("../../prisma/prismaClient");

const getDayRange = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const start = new Date(parsed);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

// Controlador para búsqueda de compras
exports.searchPurchase = async (req, res) => {
  const q = String(req.params.q ?? "").trim();
  const numericValue = Number(q);
  const isNumeric = Number.isFinite(numericValue);
  const dateRange = getDayRange(q);

  const or = [
    { proveedores: { is: { nombre: { contains: q, mode: "insensitive" } } } },
    { proveedores: { is: { nit: { contains: q, mode: "insensitive" } } } },
    { estado_compra: { contains: q, mode: "insensitive" } },
    {
      detalle_compra: {
        some: {
          detalle_productos: {
            is: {
              productos: { nombre: { contains: q, mode: "insensitive" } },
            },
          },
        },
      },
    },
  ];

  if (isNumeric) {
    or.push({ id_compra: numericValue });
    or.push({ total: numericValue });
  }

  if (dateRange) {
    or.push({
      fecha_compra: {
        gte: dateRange.start,
        lt: dateRange.end,
      },
    });
  }

  try {
    const purchase = await prisma.compras.findMany({
      where: { OR: or },
      orderBy: { id_compra: "desc" },
      include: {
        proveedores: true,
        detalle_compra: {
          include: {
            detalle_productos: {
              include: { productos: true },
            },
          },
        },
      },
    });

    return res.status(200).json({ purchase });
  } catch (error) {
    return res.status(500).json({ error: "Error al buscar las compras" });
  }
};
