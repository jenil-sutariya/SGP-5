import prisma from '../../database/prisma';

export class SettingsService {
  async listGlobal() {
    return prisma.setting.findMany({ orderBy: { category: 'asc' } });
  }

  async upsertGlobal(key: string, value: any, category?: string, label?: string) {
    return prisma.setting.upsert({
      where: { key },
      create: { key, value, category: category ?? 'general', label: label ?? key },
      update: { value, label },
    });
  }

  async getUserSettings(userId: string) {
    return prisma.userSetting.findUnique({ where: { userId } });
  }

  async updateUserSettings(userId: string, data: Record<string, unknown>) {
    return prisma.userSetting.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}

export const settingsService = new SettingsService();
