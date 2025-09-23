import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

// Configurar el logger para auditoría de seguridad
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'authorization-audit' },
  transports: [
    new winston.transports.File({ filename: 'logs/auth-audit.log' })
  ]
});

type GetOwnerIdFn = (req: Request) => Promise<string | null>;

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role?: string;
  };
}

/**
 * Middleware que valida la propiedad del recurso o rol de administrador
 * @param getOwnerId Función que obtiene el ID del propietario del recurso
 */
export function ensureOwnerOrAdmin(getOwnerId: GetOwnerIdFn) {
  return async function(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user) {
      auditLogger.warn('Intento de acceso sin autenticación', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(401).json({ error: 'No autenticado' });
    }

    try {
      const ownerId = await getOwnerId(req);
      
      if (!ownerId) {
        auditLogger.info('Recurso no encontrado', {
          path: req.path,
          method: req.method,
          userId: req.user.id,
          ip: req.ip
        });
        return res.status(404).json({ error: 'Recurso no encontrado' });
      }

      const isOwner = String(req.user.id) === String(ownerId);
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        auditLogger.warn('Intento de acceso no autorizado', {
          path: req.path,
          method: req.method,
          userId: req.user.id,
          resourceOwnerId: ownerId,
          userRole: req.user.role,
          ip: req.ip
        });
        return res.status(403).json({ error: 'No autorizado' });
      }

      auditLogger.info('Acceso autorizado', {
        path: req.path,
        method: req.method,
        userId: req.user.id,
        resourceOwnerId: ownerId,
        userRole: req.user.role,
        accessType: isOwner ? 'owner' : 'admin',
        ip: req.ip
      });

      next();
    } catch (err) {
      auditLogger.error('Error en validación de autorización', {
        path: req.path,
        method: req.method,
        userId: req.user.id,
        error: err instanceof Error ? err.message : 'Unknown error',
        ip: req.ip
      });
      next(err);
    }
  };
}