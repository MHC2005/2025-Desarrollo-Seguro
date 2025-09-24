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
  // 1. Definir una lista blanca de proveedores de pago permitidos con sus URLs completas
  private static PAYMENT_PROVIDERS = {
    'visa': 'http://visa/payments',
    'master': 'http://master/payments'
  };

  static async list(userId: string, status?: string, operator?: string): Promise<Invoice[]> {
    let q = db<InvoiceRow>('invoices').where({ userId: userId });
    
    if (status && operator) {
      const allowedOperators = ['=', '!=', '<>', 'LIKE', 'NOT LIKE'];
      if (!allowedOperators.includes(operator.toUpperCase())) {
        throw new Error('Invalid operator');
      }
      
      switch(operator.toUpperCase()) {
        case '=':
          q = q.andWhere('status', '=', status);
          break;
        case '!=':
        case '<>':
          q = q.andWhere('status', '!=', status);
          break;
        case 'LIKE':
          q = q.andWhere('status', 'like', status);
          break;
        case 'NOT LIKE':
          q = q.andWhereNot('status', 'like', status);
          break;
      }
    } else if (status) {
      q = q.andWhere('status', '=', status);
    }
    
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
    
    if (!this.PAYMENT_PROVIDERS.hasOwnProperty(paymentBrand)) {
      throw new Error('Invalid payment provider');
    }

    
    const paymentUrl = this.PAYMENT_PROVIDERS[paymentBrand];

    try {
      // 4. Hacer la petición usando la URL segura
      const paymentResponse = await axios.post(paymentUrl, {
        ccNumber,
        ccv,
        expirationDate
      });

      if (paymentResponse.status !== 200) {
        throw new Error('Payment failed');
      }

      
      await db('invoices')
        .where({ id: invoiceId, userId })
        .update({ status: 'paid' });  

    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        // Mostrar la respuesta real del servidor mock
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
    // Validar que invoiceId sea un número entero válido
    const parsedInvoiceId = parseInt(invoiceId, 10);
    if (isNaN(parsedInvoiceId) || parsedInvoiceId <= 0) {
      throw new Error('Invalid invoice ID');
    }
    
    const sanitizedPdfName = path.basename(pdfName);
    if (!sanitizedPdfName || sanitizedPdfName !== pdfName) {
      throw new Error('Invalid PDF name format');
    }
    
    // check if the invoice exists
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId }).first();
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    try {
      const filePath = path.join('/invoices', sanitizedPdfName);
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`Receipt access failed for invoice ${invoiceId}: File not accessible`);
      throw new Error('Receipt not found');
    }
  }
}

export default InvoiceService;