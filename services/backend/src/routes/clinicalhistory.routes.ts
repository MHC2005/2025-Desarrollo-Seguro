import { Router } from 'express';
import { Request } from 'express';
import {
  listClinicalHistory,
  getClinicalHistory,
  createClinicalHistory
} from '../controllers/clinicalHistoryController';
import { ensureOwnerOrAdmin } from '../middleware/authorization';
import db from '../db';

const router = Router();

// Función auxiliar para obtener el ID del propietario de una historia clínica
async function getClinicalHistoryOwnerId(req: Request): Promise<string | null> {
  const record = await db('clinical_histories')
    .where('id', req.params.id)
    .first();
  return record ? record.patient_id : null;
}

// GET /clinical-history - Lista todas las historias clínicas del usuario o todas si es admin
router.get('/', listClinicalHistory);

// GET /clinical-history/:id - Obtiene una historia clínica específica
router.get('/:id', 
  ensureOwnerOrAdmin(getClinicalHistoryOwnerId),
  getClinicalHistory
);

// POST /clinical-history - Crea una nueva historia clínica
router.post('/', createClinicalHistory);

export default router;

