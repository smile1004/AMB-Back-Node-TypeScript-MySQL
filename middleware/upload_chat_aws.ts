import dotenv from 'dotenv';
dotenv.config();

import AWS from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { v4 as uuidv4 } from 'uuid';

// AWS setup
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY!,
  secretAccessKey: process.env.AWS_SECRET_KEY!,
  region: process.env.AWS_REGION!,
});

const bucketName = process.env.S3_BUCKET!;

const uploadChatFile = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const extension = file.originalname.split('.').pop();
      const fileName = `${uuidv4()}.${extension}`;
      const s3Key = `chat/${fileName}`; // ✅ S3 folder for chat uploads
      cb(null, s3Key);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // const allowedTypes = [
    //   'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    //   'application/pdf',
    //   'application/msword',
    //   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    //   'application/zip',
    // ];
    // if (!allowedTypes.includes(file.mimetype)) {
    //   console.log(`❌ Rejected file: ${file.originalname} (${file.mimetype})`);
    //   return cb(new Error('File type not allowed'), false);
    // }
    console.log(`✅ Accepted file: ${file.originalname}`);
    cb(null, true);
  },
});

export default uploadChatFile;