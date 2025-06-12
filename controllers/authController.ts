import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../models';
const { Admin, Employer, JobSeeker } = db;
import { Op } from "sequelize";

import errorTypes from '../utils/errorTypes';
const { NotFoundError, BadRequestError, ForbiddenError, UnauthorizedError } = errorTypes;

import dotenv from 'dotenv';
dotenv.config();

/**
 * Generate JWT token for authentication
 * @param {Object} user - User object
 * @param {String} role - User role
 * @returns {String} JWT token
 */
const generateToken = (user: any, role: any) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role
    },
    // @ts-expect-error TS(2769): No overload matches this call.
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRATION || '1d'
    }
  );
};

/**
 * Register a new job seeker
 * @route POST /api/auth/job-seeker/register
 */
const registerJobSeeker = async (req: any, res: any, next: any) => {
  try {
    const { name, email, password, ...otherData } = req.body;

    // Check if the email already exists
    const existingJobSeeker = await JobSeeker.findOne({ where: { email } });
    const existingEmployer = await Employer.findOne({ where: { email } });
    const existingAdmin = await Admin.findOne({ where: { email } });

    if (existingJobSeeker || existingEmployer || existingAdmin) {
      throw new BadRequestError('Email is already registered');
    }
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create job seeker
    const jobSeeker = await JobSeeker.create({
      name,
      email,
      password: hashedPassword,
      ...otherData
    });

    // Generate JWT token
    const token = generateToken(jobSeeker, 'jobSeeker');

    // Return response
    res.status(201).json({
      success: true,
      data: {
        user: jobSeeker.toJSON(),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a new employer
 * @route POST /api/auth/employer/register
 */
const registerEmployer = async (req: any, res: any, next: any) => {
  try {
    const { clinic_name, email, password, ...otherData } = req.body;

    // Check if the email already exists
    const existingJobSeeker = await JobSeeker.findOne({ where: { email } });
    const existingEmployer = await Employer.findOne({ where: { email } });
    const existingAdmin = await Admin.findOne({ where: { email } });

    if (existingJobSeeker || existingEmployer || existingAdmin) {
      throw new BadRequestError('Email is already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create employer
    const employer = await Employer.create({
      clinic_name,
      email,
      password: hashedPassword,
      ...otherData
    });

    // Generate JWT token
    const token = generateToken(employer, 'employer');

    // Return response
    res.status(201).json({
      success: true,
      data: {
        user: employer.toJSON(),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login for job seeker
 * @route POST /api/auth/job-seeker/login
 */
const loginJobSeeker = async (req: any, res: any, next: any) => {
  try {
    const { email, password } = req.body;
    // Check if the user exists
    const jobSeeker = await JobSeeker.findOne({ where: { email } });
    if (!jobSeeker) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if the user is deleted
    if (jobSeeker.deleted) {
      throw new UnauthorizedError('Account deactivated');
    }

    // Check password
    const isMatch = await bcrypt.compare(password, jobSeeker.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate JWT token
    const token = generateToken(jobSeeker, 'jobseeker');

    // Return response
    res.status(200).json({
      success: true,
      data: {
        role: "JobSeeker",
        user: jobSeeker.toJSON(),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login for employer
 * @route POST /api/auth/employer/login
 */
const loginEmployer = async (req: any, res: any, next: any) => {
  try {
    const { email, password } = req.body;
    // Check if the user exists
    const employer = await Employer.findOne({ where: { email } });
    if (!employer) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if the user is deleted
    if (employer.deleted) {
      throw new UnauthorizedError('Account deactivated');
    }

    // Check password
    const isMatch = await bcrypt.compare(password, employer.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate JWT token
    const token = generateToken(employer, 'employer');

    // Return response
    res.status(200).json({
      success: true,
      data: {
        role: "Employer",
        user: employer.toJSON(),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login for admin
 * @route POST /api/auth/admin/login
 */
const loginAdmin = async (req: any, res: any, next: any) => {
  try {
    const { email, password } = req.body;

    // Check if the admin exists
    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate JWT token
    const token = generateToken(admin, 'admin');

    // Return response
    res.status(200).json({
      success: true,
      data: {
        role: admin.toJSON().role,
        user: admin.toJSON(),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};


const unifiedLogin = async (req: any, res: any, next: any) => {
  try {
    const { email, password } = req.body;
    
    let user = null;
    let role = '';

    // Try to find the user in JobSeeker table
    user = await JobSeeker.findOne({ where: { email } });
    if (user) {
      if (user.deleted) throw new UnauthorizedError('Account deactivated');
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) throw new UnauthorizedError('Invalid credentials');
      role = 'JobSeeker';
    }

    // If not found in JobSeeker, try Employer
    if (!user) {
      user = await Employer.findOne({ where: { email } });
      if (user) {
        if (user.deleted) throw new UnauthorizedError('Account deactivated');
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new UnauthorizedError('Invalid credentials');
        role = 'Employer';
      }
    }

    // If still not found, try Admin
    if (!user) {
      user = await Admin.findOne({ where: { email } });
      if (user) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new UnauthorizedError('Invalid credentials');
        role = user.role || 'Admin';
      }
    }

    // If still not found, throw error
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate token
    const token = generateToken(user, role.toLowerCase());

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        role,
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/me
 */
const getCurrentUser = async (req: any, res: any, next: any) => {
  try {
    const { id, role } = req.user;
    let user;

    // Get user based on role
    switch (role) {
      case 'admin':
        user = await Admin.findByPk(id);
        break;
      case 'employer':
        user = await Employer.findByPk(id, {
          attributes: { exclude: ['password'] }
        });
        break;
      case 'jobSeeker':
        user = await JobSeeker.findByPk(id, {
          attributes: { exclude: ['password'] }
        });
        break;
      default:
        throw new UnauthorizedError('Invalid role');
    }

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 * @route PUT /api/auth/change-password
 */
const changePassword = async (req: any, res: any, next: any) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { id, role } = req.user;

    let user;

    // Get user based on role
    switch (role) {
      case 'admin':
        user = await Admin.findByPk(id);
        break;
      case 'employer':
        user = await Employer.findByPk(id);
        break;
      case 'jobSeeker':
        user = await JobSeeker.findByPk(id);
        break;
      default:
        throw new UnauthorizedError('Invalid role');
    }

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    user.modified = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

import crypto from "crypto";
import nodemailer from "nodemailer";




const requestPasswordReset = async (req: any, res: any, next: any) => {
  try {
    const { email, role } = req.body; // Role: "employer" or "jobSeeker"

    const Model = role === "employer" ? Employer : JobSeeker;
    const user = await Model.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.reset_token = resetToken;
    user.token_expiry = new Date(Date.now() + 15 * 60 * 1000); // 🔹 Expiry in 15 mins
    await user.save();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false, // Change to `true` if using port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    transporter.verify((error, success) => {
      if (error) {
        console.error("SMTP Connection Failed:", error);
      } else {
        console.log("SMTP Connection Successful!");
      }
    });


    const resetLink = `https://reuse-tenshoku.com/reset-password?token=${resetToken}&role=${role}`;

    await transporter.sendMail({
      // from: `"Your Name" <your-email@gmail.com>`,
      from: `"Reuse-tenshoku" <your-email@gmail.com>`,
      to: email,
      subject: "【リユース転職】求職者、パスワード再発行用URLのご案内",
      text:
        `

こんにちは。リユース転職運営事務局です。
リユース転職をご利用いただきありがとうございます。

ご本人様確認のため、下記URLへ「15分以内」にアクセスし
「パスワード再設定画面」から再設定をお願いいたします。
${resetLink}

※当メール送信後、15分を超過しますと、セキュリティ保持のため有効期限切れとなります。
　その場合は再度、最初からお手続きをお願い致します。

※お使いのメールソフトによってはURLが途中で改行されることがあります。
　その場合は、URLの先頭から末尾の英数字までをブラウザに
　直接コピー＆ペーストしてアクセスしてください。

※当メールは送信専用メールアドレスから配信されています。
　このままご返信いただいてもお答えできませんのでご了承ください。

※当メールに心当たりの無い場合は、誠に恐れ入りますが
　破棄して頂けますよう、よろしくお願い致します。

----------------------------------------------------------

その他ご不明な点・ご質問などございましたら、リユース転職運営事務局までお問い合わせください。
※本メールは、ご登録いただいたメールアドレス宛に自動的にお送りしています。
身に覚えのない場合には下記までお問い合わせください。

■ リユース転職へのお問い合わせ
https://reuse-tenshoku.com/CONTACT
=====================================

リユース・リサイクル・買取業界専門の転職サービス リユース転職
HP：https://reuse-tenshoku.com/job-openings/

`,
    });

    res.status(200).json({ success: true, message: "Reset email sent!" });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req: any, res: any, next: any) => {
  try {
    const { token, role, newPassword } = req.body;

    const Model = role === "employer" ? Employer : JobSeeker;
    const user = await Model.findOne({
      where: { reset_token: token, token_expiry: { [Op.gt]: new Date() } },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.reset_token = null;
    user.token_expiry = null;
    await user.save();

    res.status(200).json({ success: true, message: "Password reset successful!" });
  } catch (error) {
    next(error);
  }
};


export default {
  registerJobSeeker,
  registerEmployer,
  loginJobSeeker,
  loginEmployer,
  loginAdmin,
  unifiedLogin,
  getCurrentUser,
  changePassword,
  requestPasswordReset,
  resetPassword
};