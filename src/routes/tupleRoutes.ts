import { Router } from 'express';
import * as tupleController from '../controllers/tupleController.js';

const router = Router();

// GET /api/tuples/teachers - List of teachers for student to browse
router.get('/teachers', tupleController.getTeachers);

// GET /api/tuples/my-tuples - List of tuples for current user (pending & accepted)
router.get('/my-tuples', tupleController.getMyTuples);

// POST /api/tuples/request - Student sends connection request to teacher
router.post('/request', tupleController.requestConnection);

// POST /api/tuples/respond - Teacher accepts or declines request
router.post('/respond', tupleController.respondToRequest);

export default router;
