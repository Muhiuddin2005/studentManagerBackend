import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';
import { uploadMiddleware } from '../services/storageService.js';

const router: Router = Router();

router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTaskById);
router.post('/', taskController.createTask);
router.patch('/:id/status', taskController.updateTaskStatus);
router.post('/:id/attachments', uploadMiddleware.single('file'), taskController.uploadAttachment);
router.post('/:id/comments', taskController.addComment);

export default router;
