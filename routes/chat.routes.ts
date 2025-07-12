import express from 'express';
import chatController from '../controllers/chatController';
import authMiddleware from '../middleware/authMiddleware';
const { verifyToken, isEmployer, isJobSeeker, isAdmin } = authMiddleware;

const router = express.Router();
router.get('/', verifyToken, chatController.getUserChats);
router.get('/:chat_id', chatController.getChatMessages);
router.get('/mark/:chat_id', verifyToken, chatController.markMessagesRead);

router.put('/messages/:id', verifyToken, chatController.editMessage);
router.delete('/messages/:id', verifyToken, chatController.deleteMessage);

export default router;