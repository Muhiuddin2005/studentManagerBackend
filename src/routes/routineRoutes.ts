import { Router } from 'express';
import * as routineController from '../controllers/routineController.js';

const router: Router = Router();

router.get('/', routineController.getRoutines);
router.post('/', routineController.createRoutine);
router.delete('/:id', routineController.deleteRoutine);

// Automated Daily Morning Routine Briefing manual/cron trigger
router.post('/trigger-daily-email', routineController.triggerDailyRoutineBriefing);
router.get('/trigger-daily-email', routineController.triggerDailyRoutineBriefing);

export default router;
