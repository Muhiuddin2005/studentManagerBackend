import { Router } from 'express';
import * as routineController from '../controllers/routineController.js';

const router: Router = Router();

router.get('/', routineController.getRoutines);
router.post('/', routineController.createRoutine);
router.delete('/:id', routineController.deleteRoutine);

export default router;
