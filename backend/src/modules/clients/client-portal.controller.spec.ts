import { ClientPortalController } from './client-portal.controller';

describe('ClientPortalController', () => {
  it('usa el precio del tarifario e ignora el precio enviado por el cliente', async () => {
    const prisma = {
      pet: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pet-1', clientId: 'client-1' }),
      },
      service: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'service-1',
          active: true,
          price: '40',
          priceLabel: 'Precio oficial',
          durationMinutes: 30,
        }),
      },
    };
    const appointmentsService = {
      create: jest.fn().mockImplementation(async payload => payload),
    };
    const controller = new ClientPortalController(prisma as any, appointmentsService as any);

    await controller.createAppointment('client-1', {
      petId: 'pet-1',
      serviceId: 'service-1',
      scheduledAt: '2026-08-01T12:00:00.000Z',
      reason: 'Consulta',
      quotedPrice: 0.01,
      priceNote: 'Precio manipulado',
    });

    expect(appointmentsService.create).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1',
      petId: 'pet-1',
      serviceId: 'service-1',
      quotedPrice: 40,
      priceNote: 'Precio oficial',
      durationMinutes: 30,
    }));
  });
});
