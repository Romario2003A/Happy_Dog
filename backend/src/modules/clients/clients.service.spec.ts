import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  const transactionClient = {
    client: { findUnique: jest.fn(), delete: jest.fn() },
    medicalRecord: { deleteMany: jest.fn() },
    sale: { deleteMany: jest.fn() },
    appointment: { deleteMany: jest.fn() },
    pet: { deleteMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient)),
  };
  const service = new ClientsService(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('elimina en una transacción los datos vinculados del cliente', async () => {
    transactionClient.client.findUnique.mockResolvedValue({
      id: 'client-1',
      pets: [{ id: 'pet-1' }],
      appointments: [{ id: 'appointment-1' }],
      sales: [],
    });

    await expect(service.remove('client-1')).resolves.toEqual({
      deleted: true,
      clientId: 'client-1',
      pets: 1,
      appointments: 1,
      sales: 0,
    });
    expect(transactionClient.medicalRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { appointmentId: { in: ['appointment-1'] } },
          { petId: { in: ['pet-1'] } },
        ],
      },
    });
    expect(transactionClient.sale.deleteMany).toHaveBeenCalledWith({ where: { clientId: 'client-1' } });
    expect(transactionClient.appointment.deleteMany).toHaveBeenCalledWith({ where: { clientId: 'client-1' } });
    expect(transactionClient.pet.deleteMany).toHaveBeenCalledWith({ where: { clientId: 'client-1' } });
    expect(transactionClient.client.delete).toHaveBeenCalledWith({ where: { id: 'client-1' } });
  });

  it('no intenta eliminar un cliente inexistente', async () => {
    transactionClient.client.findUnique.mockResolvedValue(null);
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(transactionClient.client.delete).not.toHaveBeenCalled();
  });
});
