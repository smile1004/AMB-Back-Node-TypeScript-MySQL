import express from 'express';
import uploadChatFile from '../middleware/upload_chat_aws'; // 🔥 use new upload
import authMiddleware from '../middleware/authMiddleware';
const { verifyToken, isEmployer, isJobSeeker, isAdmin } = authMiddleware;

const router = express.Router();

router.post('/file', verifyToken, uploadChatFile.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const filePath = (req.file as any).location;
  const fileName = req.file.originalname;

  res.json({ success: true, filePath, fileName });
});

export default router;