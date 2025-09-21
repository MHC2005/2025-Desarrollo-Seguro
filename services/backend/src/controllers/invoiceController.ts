import { Request, Response, NextFunction } from 'express';
import InvoiceService from '../services/invoiceService';
import { Invoice } from '../types/invoice';

const listInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = req.query.status as string | undefined;
    const operator = req.query.operator as string | undefined;
    
    if (operator) {
      const allowedOperators = ['=', '!=', '<>', 'LIKE', 'NOT LIKE'];
      if (!allowedOperators.includes(operator.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid operator. Allowed operators: =, !=, <>, LIKE, NOT LIKE' });
      }
    }
    
    if (state && typeof state !== 'string') {
      return res.status(400).json({ error: 'Status parameter must be a string' });
    }
    
    const id   = (req as any).user!.id; 
    const invoices = await InvoiceService.list(id, state, operator);
    res.json(invoices);
  } catch (err) {
    next(err);
  }
};

const setPaymentCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceId = req.params.id;
    
    const parsedInvoiceId = parseInt(invoiceId, 10);
    if (isNaN(parsedInvoiceId) || parsedInvoiceId <= 0) {
      return res.status(400).json({ error: 'Invalid invoice ID format' });
    }
    
    const paymentBrand = req.body.paymentBrand;
    const ccNumber = req.body.ccNumber;
    const ccv = req.body.ccv;
    const expirationDate = req.body.expirationDate;

    if (!paymentBrand || !ccNumber || !ccv || !expirationDate) {
      return res.status(400).json({ error: 'Missing payment details' });
    }
    const id   = (req as any).user!.id; 
    await InvoiceService.setPaymentCard(
      id,
      invoiceId,
      paymentBrand,
      ccNumber,
      ccv,
      expirationDate
    );

    res.status(200).json({ message: 'Payment successful' });
  } catch (err) {
    next(err);
  }
};

const getInvoicePDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceId = req.params.id;
    
    const parsedInvoiceId = parseInt(invoiceId, 10);
    if (isNaN(parsedInvoiceId) || parsedInvoiceId <= 0) {
      return res.status(400).json({ error: 'Invalid invoice ID format' });
    }
    
    const pdfName = req.query.pdfName as string | undefined;

    if (!pdfName) {
      return res.status(400).json({ error: 'Missing parameter pdfName' });
    }
    const pdf = await InvoiceService.getReceipt(invoiceId, pdfName);
    // return the pdf as a binary response
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);

  } catch (err) {
    next(err);
  }
};

const getInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceId = req.params.id;
    
    const parsedId = parseInt(invoiceId, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      return res.status(400).json({ error: 'Invalid invoice ID format' });
    }
    
    const invoice = await InvoiceService.getInvoice(invoiceId);
    res.status(200).json(invoice);

  } catch (err) {
    next(err);
  }
};

export default {
  listInvoices,
  setPaymentCard,
  getInvoice,
  getInvoicePDF
};