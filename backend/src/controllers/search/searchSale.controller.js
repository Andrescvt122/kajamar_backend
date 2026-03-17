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

const searachSale = async (req, res) => {
  const q = String(req.params.q ?? "").trim();
  const numericValue = Number(q);
  const isNumeric = Number.isFinite(numericValue);
  const dateRange = getDayRange(q);

  const or = [
    { clientes: { is: { nombre_cliente: { contains: q, mode: "insensitive" } } } },
    { metodo_pago: { contains: q, mode: "insensitive" } },
    { estado_venta: { contains: q, mode: "insensitive" } },
    {
      detalle_venta: {
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
    or.push({ id_venta: numericValue });
    or.push({ total: numericValue });
  }

  if (dateRange) {
    or.push({
      fecha_venta: {
        gte: dateRange.start,
        lt: dateRange.end,
      },
    });
  }

  try {
    const sale = await prisma.ventas.findMany({
      where: { OR: or },
      orderBy: { id_venta: "desc" },
      include: {
        clientes: true,
        detalle_venta: {
          include: {
            detalle_productos: {
              include: { productos: true },
            },
          },
        },
      },
    });

    return res.status(200).json({ sale });
  } catch (error) {
    return res.status(500).json({ error: "Error al buscar las ventas" });
  }
};

module.exports = { searachSale };
