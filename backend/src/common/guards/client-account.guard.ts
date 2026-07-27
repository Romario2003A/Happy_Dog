import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ClientAccountGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clientId = request.user?.id;
    if (!clientId) return false;

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, active: true },
      select: { id: true },
    });
    if (!client) return false;

    // The database is the source of truth for client access. This also repairs
    // sessions issued before the CLIENT role was included in the token.
    request.user.role = 'CLIENT';
    return true;
  }
}
