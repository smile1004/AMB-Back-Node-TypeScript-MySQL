import express from 'express';
const router = express.Router();

// Import the default export object from authController.js
import authController from '../controllers/authController';

// Import middleware normally
import authMiddleware from '../middleware/authMiddleware';
const { verifyToken, isEmployer, isJobSeeker, isAdmin } = authMiddleware;
import validationMiddleware from '../middleware/validationMiddleware';


// Job Seeker Routes
router.post('/job-seeker/register', validationMiddleware.jobSeekerRegisterValidation, authController.registerJobSeeker);
router.post('/job-seeker/update', verifyToken, isJobSeeker, validationMiddleware.jobSeekerRegisterValidation, authController.updateJobSeeker);
router.post('/job-seeker/login', validationMiddleware.loginValidation, authController.loginJobSeeker);

// Employer Routes
router.post('/employer/register', validationMiddleware.employerRegisterValidation, authController.registerEmployer);
router.post('/employer/update', verifyToken, isEmployer, validationMiddleware.employerRegisterValidation, authController.updateEmployer);
router.post('/employer/login', validationMiddleware.loginValidation, authController.loginEmployer);

// Admin Routes
router.post('/admin/login', validationMiddleware.loginValidation, authController.loginAdmin);

// Unified Login
router.post('/login', validationMiddleware.loginValidation, authController.unifiedLogin);

// General Routes
router.get('/me', authMiddleware.verifyToken, authController.getCurrentUser);
router.put('/change-password', authMiddleware.verifyToken, authController.changePassword);
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

export default router;
