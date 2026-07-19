import { RoleName } from '@prisma/client';
import prisma from '../../database/prisma';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '../../utils/AppError';
import {
  hashPassword,
  comparePassword,
  createTokenPair,
  verifyRefreshToken,
  generateSecureToken,
  parseExpiryToDate,
  sanitizeUser,
} from '../../utils/auth';
import { config } from '../../config';
import { isCharusatEmail, UNIVERSITY } from '../../config/university';
import { RegisterInput, LoginInput } from './auth.validator';
import { logger } from '../../utils/logger';

export class AuthService {
  async register(input: RegisterInput) {
    if (!isCharusatEmail(input.email)) {
      throw new ValidationError(
        `Only ${UNIVERSITY.shortName} emails are allowed (${UNIVERSITY.emailDomains.join(', ')})`
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const roleName = input.role ?? RoleName.STUDENT;
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new ValidationError(`Role ${roleName} not found. Seed the database first.`);
    }

    if (roleName === RoleName.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: { name: RoleName.ADMIN } },
      });
      if (adminCount > 0 && process.env.ALLOW_ADMIN_REGISTER !== 'true') {
        throw new ValidationError('Admin registration is restricted');
      }
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        roleId: role.id,
        departmentId: input.departmentId,
        settings: { create: {} },
      },
      include: { role: true, department: true },
    });

    const tokens = createTokenPair(user.id, user.email, user.role.name);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    return { user: sanitizeUser(user), ...tokens };
  }

  async login(input: LoginInput, meta?: { userAgent?: string; ipAddress?: string }) {
    if (!isCharusatEmail(input.email)) {
      throw new UnauthorizedError(
        `Use your ${UNIVERSITY.shortName} email (@${UNIVERSITY.emailDomains[0]})`
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        role: true,
        department: true,
        institute: true,
        faculty: true,
        student: { include: { section: true, batch: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await comparePassword(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = createTokenPair(user.id, user.email, user.role.name);
    await this.persistRefreshToken(user.id, tokens.refreshToken, meta);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return { user: sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired or revoked');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = createTokenPair(user.id, user.email, user.role.name);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const token = generateSecureToken();
    await prisma.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    logger.info('Password reset token generated', { userId: user.id, token: config.isDev ? token : '[redacted]' });

    return {
      message: 'If the email exists, a reset link has been sent',
      ...(config.isDev ? { resetToken: token } : {}),
    };
  }

  async resetPassword(token: string, password: string) {
    const reset = await prisma.passwordReset.findUnique({ where: { token } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) throw new ValidationError('Current password is incorrect');

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return { message: 'Password changed successfully' };
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        department: true,
        institute: true,
        faculty: true,
        student: { include: { section: true, batch: true } },
        settings: true,
      },
    });
    if (!user) throw new NotFoundError('User');
    return sanitizeUser(user);
  }

  private async persistRefreshToken(
    userId: string,
    token: string,
    meta?: { userAgent?: string; ipAddress?: string }
  ) {
    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt: parseExpiryToDate(config.jwt.refreshExpiresIn),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });
  }
}

export const authService = new AuthService();
