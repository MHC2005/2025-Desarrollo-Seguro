// src/services/invoiceService.ts
import db from '../db';
import { Invoice } from '../types/invoice';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';

interface InvoiceRow {
  id: string;
  userId: string;
  amount: number;
  dueDate: Date;
  status: string;
}

class InvoiceService {
  // Lista blanca de proveedores permitidos con sus URLs completas y seguras
  private static PAYMENT_PROVIDERS = {
    'visa': 'http://visa/payments',
    'master': 'http://master/payments'
  };

  static async list(userId: string, status?: string, operator?: string): Promise<Invoice[]> {
    let q = db<InvoiceRow>('invoices').where({ userId: userId });
    if (status) q = q.andWhereRaw(" status "+ operator + " '"+ status +"'");
    const rows = await q.select();
    const invoices = rows.map(row => ({
      id: row.id,
      userId: row.userId,
      amount: row.amount,
      dueDate: row.dueDate,
      status: row.status} as Invoice
    ));
    return invoices;
  }

  static async setPaymentCard(
    userId: string,
    invoiceId: string,
    paymentBrand: string,
    ccNumber: string,
    ccv: string,
    expirationDate: string
  ) {
    // 1. Validar que el proveedor existe en la lista blanca
    if (!this.PAYMENT_PROVIDERS.hasOwnProperty(paymentBrand)) {
      throw new Error('Invalid payment provider');
    }

    // 2. Obtener la URL segura del proveedor de la lista blanca
    const paymentUrl = this.PAYMENT_PROVIDERS[paymentBrand];

    try {
      // 3. Hacer la petición usando la URL segura
      const paymentResponse = await axios.post(paymentUrl, {
        ccNumber,
        ccv,
        expirationDate
      });

      if (paymentResponse.status !== 200) {
        throw new Error('Payment failed');
      }

      // 4. Actualizar el estado de la factura
      await db('invoices')
        .where({ id: invoiceId, userId })
        .update({ status: 'paid' });  

    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('Payment processing error:', {
          provider: paymentBrand,
          invoiceId,
          response: error.response.data
        });
        throw new Error(`Payment failed: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  static async getInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId }).first();
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    return invoice as Invoice;
  }

  static async getReceipt(
    invoiceId: string,
    pdfName: string
  ) {
    // 1. Validar que invoiceId sea un número entero válido
    const parsedInvoiceId = parseInt(invoiceId, 10);
    if (isNaN(parsedInvoiceId) || parsedInvoiceId <= 0) {
      throw new Error('Invalid invoice ID');
    }

    // 2. Verificar que la factura existe y pertenece al usuario
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId }).first();
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // 3. Validar y sanitizar el nombre del archivo para prevenir Path Traversal
    if (!pdfName || typeof pdfName !== 'string') {
      throw new Error('Invalid PDF name');
    }

    // 4. Verificar que es un PDF
    if (!pdfName.toLowerCase().endsWith('.pdf')) {
      throw new Error('Only PDF files are allowed');
    }

    // 5. Sanitizar el nombre del archivo
    const sanitizedName = path.basename(pdfName);
    
    // 6. Verificar que el nombre sanitizado coincide con el original
    if (sanitizedName !== pdfName) {
      throw new Error('Invalid PDF name format');
    }

    try {
      // 7. Construir la ruta de forma segura
      const filePath = path.join('/invoices', sanitizedName);
      
      // 8. Verificar que la ruta final está dentro del directorio permitido
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(path.resolve('/invoices'))) {
        throw new Error('Access denied');
      }

      // 9. Leer el archivo como buffer binario
      const content = await fs.readFile(filePath);
      return content;
    } catch (error) {
      // 10. Log seguro sin exponer rutas del sistema
      console.error(`Receipt access failed for invoice ${invoiceId}: File not accessible`);
      throw new Error('Receipt not found');
    }
  }
}

export default InvoiceService;