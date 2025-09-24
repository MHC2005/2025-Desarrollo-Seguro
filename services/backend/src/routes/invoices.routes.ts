import { Router } from 'express';
import { Request } from 'express';
import routes from '../controllers/invoiceController';
import { ensureOwnerOrAdmin } from '../middleware/authorization';
import db from '../db';

const router = Router();

// Función auxiliar para obtener el ID del propietario de una factura
async function getInvoiceOwnerId(req: Request): Promise<string | null> {
  const invoice = await db('invoices')
    .where('id', req.params.id)
    .first();
  return invoice ? invoice.userId : null;
}

// GET /invoices - Lista todas las facturas del usuario o todas si es admin
router.get('/', routes.listInvoices);

// GET /invoices/:id - Obtiene una factura específica
router.get('/:id', 
  ensureOwnerOrAdmin(getInvoiceOwnerId),
  routes.getInvoice
);

// POST /invoices/:id/pay - Procesa el pago de una factura
router.post('/:id/pay',
  // Primero validamos la autorización antes de procesar cualquier dato
  ensureOwnerOrAdmin(getInvoiceOwnerId),
  // Luego procesamos el pago si está autorizado
  routes.setPaymentCard
);

// GET /invoices/:id/invoice - Obtiene el PDF de una factura
router.get('/:id/invoice',
  ensureOwnerOrAdmin(getInvoiceOwnerId),
  routes.getInvoicePDF
);

export default router;
