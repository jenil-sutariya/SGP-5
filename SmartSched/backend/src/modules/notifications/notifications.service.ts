import prisma from '../../database/prisma';
import { NotFoundError } from '../../utils/AppError';
import { getPagination } from '../../utils/pagination';

export class NotificationsService {
  async list(userId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query);
    const where = { userId };
    const [data, total] = await Promise.all([
      prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async markRead(id: string, userId: string) {
    const n = await prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundError('Notification');
    return prisma.notification.update({ where: { id: n.id }, data: { isRead: true } });
  }

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { message: 'All notifications marked as read' };
  }
}

export const notificationsService = new NotificationsService();
