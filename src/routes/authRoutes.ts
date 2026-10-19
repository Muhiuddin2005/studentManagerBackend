import { Router } from 'express';
import * as authController from '../controllers/authController.js';

const router: Router = Router();

router.get('/me', authController.getMe);
router.post('/register', authController.register);
router.post('/verify', authController.verifyEmail);
router.post('/login', authController.login);
router.post('/verify-login', authController.verifyLogin);
router.post('/resend-code', authController.resendCode);
router.post('/switch-role', authController.switchRole);
router.post('/demo-login', authController.demoLogin);

export default router;


