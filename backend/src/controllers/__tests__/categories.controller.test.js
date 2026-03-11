const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../categories.controller');

jest.mock('../../prisma/prismaClient', () => ({
  categorias: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
}));

const prisma = require('../../prisma/prismaClient');

const crearRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('categories.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe listar categorías paginadas', async () => {
    const req = { query: { page: '2', limit: '3', search: 'hogar' } };
    const res = crearRes();

    prisma.categorias.findMany.mockResolvedValue([
      { id_categoria: 10, nombre_categoria: 'Hogar' },
    ]);
    prisma.categorias.count.mockResolvedValue(7);

    await getCategories(req, res);

    expect(prisma.categorias.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 3,
        take: 3,
        orderBy: { id_categoria: 'desc' },
      })
    );
    expect(prisma.categorias.count).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id_categoria: 10, nombre_categoria: 'Hogar' }],
      currentPage: 2,
      totalPages: 3,
      totalItems: 7,
    });
  });

  test('debe retornar 400 si falta nombre_categoria al crear', async () => {
    const req = { body: { descripcion_categoria: 'Sin nombre' } };
    const res = crearRes();

    await createCategory(req, res);

    expect(prisma.categorias.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El nombre de la categoría es obligatorio.',
    });
  });

  test('debe retornar 400 si se intenta crear una categoría duplicada', async () => {
    const req = {
      body: {
        nombre_categoria: 'Bebidas',
        descripcion_categoria: 'Categoría duplicada',
      },
    };
    const res = crearRes();

    prisma.categorias.create.mockRejectedValue({ code: 'P2002' });

    await createCategory(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Ya existe una categoría con ese nombre.',
    });
  });

  test('debe retornar 404 al actualizar una categoría inexistente', async () => {
    const req = {
      params: { id: '999' },
      body: { nombre_categoria: 'Actualizada' },
    };
    const res = crearRes();

    prisma.categorias.update.mockRejectedValue({ code: 'P2025' });

    await updateCategory(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La categoría no existe o ya fue eliminada.',
    });
  });

  test('debe retornar 400 al eliminar categoría con productos asociados', async () => {
    const req = { params: { id: '5' } };
    const res = crearRes();

    prisma.categorias.findUnique.mockResolvedValue({
      id_categoria: 5,
      nombre_categoria: 'Lácteos',
    });
    prisma.categorias.delete.mockRejectedValue({ code: 'P2003' });

    await deleteCategory(req, res);

    expect(prisma.categorias.findUnique).toHaveBeenCalledWith({
      where: { id_categoria: 5 },
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        'No se puede eliminar la categoría porque tiene productos asociados. Elimina o reasigna esos productos antes de continuar.',
    });
  });
});
