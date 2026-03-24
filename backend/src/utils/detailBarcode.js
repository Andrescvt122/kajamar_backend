function normalizeDetailBarcode(value) {
  return String(value ?? "").trim();
}

function isValidDetailBarcode(barcode) {
  return /^\d{13}$/.test(normalizeDetailBarcode(barcode));
}

async function findDetailByBarcode(tx, barcode, options = {}) {
  const normalizedBarcode = normalizeDetailBarcode(barcode);
  const ignoreDetailId = Number(options.ignoreDetailId);

  if (!normalizedBarcode) return null;

  const where = {
    codigo_barras_producto_compra: normalizedBarcode,
  };

  if (Number.isFinite(ignoreDetailId) && ignoreDetailId > 0) {
    where.NOT = {
      id_detalle_producto: ignoreDetailId,
    };
  }

  return tx.detalle_productos.findFirst({
    where,
    select: {
      id_detalle_producto: true,
      id_producto: true,
      codigo_barras_producto_compra: true,
    },
  });
}

async function assertDetailBarcodeAvailable(tx, barcode, options = {}) {
  const normalizedBarcode = normalizeDetailBarcode(barcode);

  if (!normalizedBarcode) {
    const error = new Error("El código de barras es obligatorio");
    error.code = "DETAIL_BARCODE_REQUIRED";
    throw error;
  }

  if (!isValidDetailBarcode(normalizedBarcode)) {
    const error = new Error(
      "El código de barras debe tener exactamente 13 dígitos numéricos"
    );
    error.code = "DETAIL_BARCODE_INVALID";
    throw error;
  }

  const existingDetail = await findDetailByBarcode(tx, normalizedBarcode, options);

  if (existingDetail) {
    const error = new Error("El código de barras ya existe");
    error.code = "DETAIL_BARCODE_ALREADY_EXISTS";
    error.detail = existingDetail;
    throw error;
  }

  return normalizedBarcode;
}

function isDetailBarcodeUniqueConstraintError(error) {
  if (!error) return false;

  if (error.code === "DETAIL_BARCODE_ALREADY_EXISTS") {
    return true;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes("codigo_barras_producto_compra");
  }

  return String(target ?? "").includes("codigo_barras_producto_compra");
}

function isDetailBarcodeValidationError(error) {
  return [
    "DETAIL_BARCODE_REQUIRED",
    "DETAIL_BARCODE_INVALID",
    "DETAIL_BARCODE_ALREADY_EXISTS",
  ].includes(error?.code);
}

module.exports = {
  normalizeDetailBarcode,
  isValidDetailBarcode,
  findDetailByBarcode,
  assertDetailBarcodeAvailable,
  isDetailBarcodeUniqueConstraintError,
  isDetailBarcodeValidationError,
};
