import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
