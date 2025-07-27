import { Op } from 'sequelize';
import db from '../models';
const { CompanyApplication, JobInfo } = db;
import errorTypes from '../utils/errorTypes';
const { NotFoundError, BadRequestError, ForbiddenError } = errorTypes;

/**
 * Get all clinic points for a job
 * @route GET /api/jobs/:jobId/clinic-points
 */
const getCompanyApplications = async (req: any, res: any, next: any) => {
  try {
    const {
      page = 1,
      limit = 10,
      searchTerm,
    } = req.query;


    const offset = (page - 1) * limit;

    const whereCondition: any = {};
    if (searchTerm) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${searchTerm}%` } },
        { company_name: { [Op.like]: `%${searchTerm}%` } },
        { email: { [Op.like]: `%${searchTerm}%` } },
        { telephone: { [Op.like]: `%${searchTerm}%` } },
        { inquiry: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    const { count, rows: companyApplications } = await CompanyApplication.findAndCountAll({
      where: whereCondition,
      limit: parseInt(limit, 10),
      offset: offset,
    });

    const totalPages = Math.ceil(count / limit);


    res.status(200).json({
      success: true,
      data: {
        companyApplications,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages,
        },
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get clinic point by ID
 * @route GET /api/clinic-points/:id
 */
const getCompanyApplicationById = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    const companyApplication = await CompanyApplication.findByPk(id);

    if (!companyApplication) {
      throw new NotFoundError('CompanyApplication not found');
    }

    res.status(200).json({
      success: true,
      data: companyApplication
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create clinic point
 * @route POST /api/jobs/:jobId/clinic-points
 */
const createCompanyApplication = async (req: any, res: any, next: any) => {
  try {
    const { email } = req.body;
    const companyApplication = await CompanyApplication.create(req.body);

    // Send confirmation email
    try {
      const nodemailer = require('nodemailer');
      const smtpPort = parseInt(process.env.SMTP_PORT || '587');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      const subject = '企業ご担当者様お申込みありがとうございます';
      const text = `\nこの度はお申込みいただき誠にありがとうございます。\n\n【受付確認】\nご入力いただいた内容で受付いたしました。\n\n【今後の流れ】\n担当者より改めてご連絡させていただきますので、今しばらくお待ちください。\n\n【お問い合わせ先】\nご不明点等ございましたら、下記までご連絡ください。\nリユース転職運営事務局\nhttps://reuse-tenshoku.com/CONTACT\n\n今後ともどうぞよろしくお願いいたします。\n`;
      await transporter.sendMail({
        from: '"Reuse-tenshoku" <your-email@gmail.com>',
        to: email,
        subject,
        text,
      });
    } catch (mailErr) {
      // Log but do not block response
      console.error('Failed to send company application confirmation email:', mailErr);
    }

    res.status(201).json({
      success: true,
      data: companyApplication
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Delete clinic point
 * @route DELETE /api/clinic-points/:id
 */
const deleteCompanyApplication = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    const companyApplication = await CompanyApplication.findByPk(id);

    if (!companyApplication) {
      throw new NotFoundError('CompanyApplication not found');
    }

    await companyApplication.destroy();

    res.status(200).json({
      success: true,
      message: 'CompanyApplication deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getCompanyApplications,
  getCompanyApplicationById,
  createCompanyApplication,
  deleteCompanyApplication
};