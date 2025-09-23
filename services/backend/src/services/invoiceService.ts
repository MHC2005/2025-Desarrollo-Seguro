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
    // check if the invoice exists
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId }).first();
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    try {
      const filePath = `/invoices/${pdfName}`;
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      // send the error to the standard output
      console.error('Error reading receipt file:', error);
      throw new Error('Receipt not found');
    }
  }
}

export default InvoiceService;