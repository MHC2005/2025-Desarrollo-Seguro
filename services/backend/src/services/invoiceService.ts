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
  static async list( userId: string, status?: string, operator?: string): Promise<Invoice[]> {
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
    const parsedInvoiceId = parseInt(invoiceId, 10);
    if (isNaN(parsedInvoiceId) || parsedInvoiceId <= 0) {
      throw new Error('Invalid invoice ID');
    }
    
    // Map payment brands to secure endpoints
    const paymentEndpoints = {
      'visa': 'visa',
      'mastercard': 'master', 
      'master': 'master'
    };
    
    const endpoint = paymentEndpoints[paymentBrand.toLowerCase()];
    if (!endpoint) {
      throw new Error('Unsupported payment brand');
    }

    try {
      // Create a tokenized version of sensitive data for logging
      const maskedCcNumber = ccNumber.slice(0, 4) + '****' + ccNumber.slice(-4);
      console.log(`Processing payment for invoice ${invoiceId} with card ending in ${ccNumber.slice(-4)}`);

      // Call the payment service (this should be HTTPS in production)
      const paymentResponse = await axios.post(`http://${endpoint}/payments`, {
        ccNumber,
        ccv,
        expirationDate
      }, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MedSys-Payment-Service/1.0'
        }
      });

      if (paymentResponse.status !== 200) {
        throw new Error('Payment failed');
      }

      // Clear sensitive data from memory immediately after use
      ccNumber = '';
      ccv = '';
      expirationDate = '';

      // Update the invoice status in the database
      await db('invoices')
        .where({ id: invoiceId, userId })
        .update({ status: 'paid' });
        
    } catch (error) {
      // Log error without exposing sensitive payment data
      console.error(`Payment processing failed for invoice ${invoiceId}: ${error.message}`);
      throw new Error('Payment processing failed');
    }
  };
  static async  getInvoice( invoiceId:string): Promise<Invoice> {
    const parsedInvoiceId = parseInt(invoiceId, 10);
    if (isNaN(parsedInvoiceId) || parsedInvoiceId <= 0) {
      throw new Error('Invalid invoice ID');
    }
    
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
    
    // Validate and sanitize pdfName to prevent path traversal
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
      // Log error without exposing system paths or sensitive information
      console.error(`Receipt access failed for invoice ${invoiceId}: File not accessible`);
      throw new Error('Receipt not found');
    } 
  };

};

export default InvoiceService;
