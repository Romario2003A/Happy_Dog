import { ClientPortalController } from './client-portal.controller';

describe('ClientPortalController', () => {
  it('permite que el cliente complete su WhatsApp', async () => {
    const prisma = { client: { update: jest.fn().mockResolvedValue({ id: 'client-1', phone: '987654321' }) } };
    const controller = new ClientPortalController(prisma as any, {} as any);

    await expect(controller.updateMe('client-1', { phone: '987 654 321' })).resolves.toEqual(expect.objectContaining({ phone: '987654321' }));
    expect(prisma.client.update).toHaveBeenCalledWith({ where: { id: 'client-1' }, data: { phone: '987654321' } });
  });

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
