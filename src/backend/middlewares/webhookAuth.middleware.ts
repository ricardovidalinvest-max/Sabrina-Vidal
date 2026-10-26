import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getLiveConfig } from '../config/env.config';

/**
 * Middleware para validação da assinatura criptográfica do Webhook do Cal.com (HMAC SHA-256).
 */
export const validateCalcomSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const liveConfig = getLiveConfig();
    const secret = liveConfig.calcomWebhookSecret || process.env.CALCOM_WEBHOOK_SECRET;

    // Se o secret não foi definido pelo desenvolvedor, logamos aviso e permitimos continuidade segura
    if (!secret) {
      console.warn('[WebhookAuth] AVISO: CALCOM_WEBHOOK_SECRET não configurado. Ignorando validação de assinatura.');
      return next();
    }

    const signature = req.headers['x-cal-signature-256'] as string;
    if (!signature) {
      console.error('[WebhookAuth:REJECTED] Header x-cal-signature-256 ausente no webhook do Cal.com.');
      res.status(401).json({ error: 'Assinatura x-cal-signature-256 ausente no cabeçalho.' });
      return;
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    // Validação em tempo constante para mitigar timing attacks com proteção contra RangeError
    const isValid =
      sigBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expectedBuffer);

    if (!isValid) {
      console.error('[WebhookAuth:REJECTED] Assinatura do Cal.com inválida.');
      res.status(403).json({ error: 'Assinatura inválida para o webhook Cal.com.' });
      return;
    }

    next();
  } catch (error: any) {
    console.error('[WebhookAuth:ERROR] Erro ao validar assinatura do Cal.com:', error.message);
    res.status(500).json({ error: 'Falha interna na validação de assinatura.' });
  }
};

/**
 * Middleware para validação do Token de Acesso do Webhook do Asaas (asaas-access-token).
 */
export const validateAsaasToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const liveConfig = getLiveConfig();
    const expectedToken = liveConfig.asaasWebhookToken || process.env.ASAAS_WEBHOOK_TOKEN || process.env.ASAAS_WEBHOOK_SECRET;

    if (!expectedToken) {
      console.warn('[WebhookAuth] AVISO: ASAAS_WEBHOOK_TOKEN não configurado. Ignorando validação de token do Asaas.');
      return next();
    }

    // O Asaas envia o token no header 'asaas-access-token'
    const receivedToken = (req.headers['asaas-access-token'] || req.headers['authorization']) as string;

    if (!receivedToken) {
      console.error('[WebhookAuth:REJECTED] Header asaas-access-token ausente na requisição do Asaas.');
      res.status(401).json({ error: 'Header asaas-access-token não informado.' });
      return;
    }

    // Normaliza caso venha com prefixo "Bearer "
    const cleanToken = receivedToken.replace(/^Bearer\s+/i, '').trim();

    if (cleanToken !== expectedToken.trim()) {
      console.error('[WebhookAuth:REJECTED] Token do Asaas não confere com ASAAS_WEBHOOK_TOKEN configurado.');
      res.status(403).json({ error: 'Token de autenticação do Asaas inválido.' });
      return;
    }

    next();
  } catch (error: any) {
    console.error('[WebhookAuth:ERROR] Erro ao validar token do Asaas:', error.message);
    res.status(500).json({ error: 'Falha interna na autenticação do webhook Asaas.' });
  }
};
