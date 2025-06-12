import dotenv from 'dotenv';
dotenv.config();

import AWS from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { v4 as uuidv4 } from 'uuid';

// 🚀 Initialize S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY!,
  secretAccessKey: process.env.AWS_SECRET_KEY!,
  region: process.env.AWS_REGION!,
});

// 📦 Bucket name
const bucketName = process.env.S3_BUCKET!;
console.log(`📦 Using S3 Bucket: ${bucketName}`);

// 🛠️ Setup multer + S3 storage
const upload = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    // acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE, // ✅ Fix: sets correct Content-Type (e.g. image/png)
    metadata: (req, file, cb) => {
      // console.log(`📤 Starting upload for: ${file.originalname}`);
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const extension = file.originalname.split('.').pop(); // get extension like "jpg"
      const fileName = `${uuidv4()}.${extension}`; // hash-based name
      // console.log(`🔑 Generated UUID key: ${fileName}`);
      const s3Key = `uploaded/${fileName}`; // ✅ save in "uploaded/" folder
      console.log(`🔑 Generated S3 Key: ${s3Key}`);
      cb(null, s3Key);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log(`❌ File rejected: ${file.originalname} (type: ${file.mimetype})`);
      return cb(new Error('Only image files are allowed'), false);
    }
    console.log(`✅ File accepted: ${file.originalname}`);
    cb(null, true);
  },
});

export default upload;