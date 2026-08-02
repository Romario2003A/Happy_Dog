import { BadRequestException } from '@nestjs/common';
import { PublicController } from './public.controller';

describe('PublicController', () => {
  function prismaMock(service: any = null) {
    return {
      service: {
        findFirst: jest.fn().mockResolvedValue(service),
        findMany: jest.fn().mockResolvedValue(service ? [service] : []),
      },
      client: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'client-1',
          fullName: 'Cliente QA',
          phone: '999999999',
          pets: [{ id: 'pet-1', name: 'Toby' }],
        }),
      },
      pet: { create: jest.fn() },
      appointment: { create: jest.fn().mockImplementation(({ data }) => data) },
    };
  }

  it('vincula una solicitud pública al tarifario y conserva su precio', async () => {
    const service = {
      id: 'service-1',
      active: true,
      name: 'SOLO BAÑO - MENOR A 10 KG',
      price: '35',
      priceLabel: 'Precio oficial',
      requiresQuote: false,
      durationMinutes: 45,
    };
    const prisma = prismaMock(service);
    const controller = new PublicController(prisma as any);

    await controller.request({
      fullName: 'Cliente QA',
      phone: '999999999',
      petName: 'Toby',
      serviceId: 'service-1',
      reason: 'CLIENT_DATE_REQUEST::SOLO BAÑO - MENOR A 10 KG',
      scheduledAt: '2026-08-03T17:00:00.000Z',
    });

    expect(prisma.appointment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceId: 'service-1',
        quotedPrice: 35,
        priceNote: 'Precio oficial',
        durationMinutes: 45,
      }),
    });
  });

  it('rechaza un servicio público inactivo o inexistente', async () => {
    const controller = new PublicController(prismaMock(null) as any);

    await expect(controller.request({
      fullName: 'Cliente QA',
      phone: '999999999',
      petName: 'Toby',
      serviceId: 'service-invalido',
      reason: 'Consulta',
      scheduledAt: '2026-08-03T17:00:00.000Z',
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
