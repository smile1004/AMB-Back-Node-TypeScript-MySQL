import { Op } from 'sequelize';
import db from '../models';
const { Contact, JobInfo } = db;
import errorTypes from '../utils/errorTypes';
const { NotFoundError, BadRequestError, ForbiddenError } = errorTypes;

/**
 * Get all clinic points for a job
 * @route GET /api/jobs/:jobId/clinic-points
 */
const getContacts = async (req: any, res: any, next: any) => {
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

    const { count, rows: contacts } = await Contact.findAndCountAll({
      where: whereCondition,
      limit: parseInt(limit, 10),
      offset: offset,
    });

    const totalPages = Math.ceil(count / limit);


    res.status(200).json({
      success: true,
      data: {
        contacts,
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
const getContactById = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findByPk(id);

    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create clinic point
 * @route POST /api/jobs/:jobId/clinic-points
 */
const createContact = async (req: any, res: any, next: any) => {
  try {
    const { title, description, email, name, inquiry_detail } = req.body;

    const contact = await Contact.create(req.body);

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
      const subject = 'お問い合わせありがとうございます';
      const text = `\nこの度はお問い合わせいただき誠にありがとうございます。\n\n【受付確認】\nご入力いただいた内容で受付いたしました。\n\n【今後の流れ】\n担当者より改めてご連絡させていただきますので、今しばらくお待ちください。\n`;
      await transporter.sendMail({
        from: '"Reuse-tenshoku" <your-email@gmail.com>',
        to: email,
        subject,
        text,
      });

      const adminsubject = `${name}さんからお問い合わせがありました。`;
      const admintext = `\nご入力内容\n\nお名前：${name}\nメールアドレス：${email}\nお問い合わせ内容${inquiry_detail}\n`;
      await transporter.sendMail({
        from: '"Reuse-tenshoku" <your-email@gmail.com>',
        to: "admin@example.com",
        adminsubject,
        admintext,
      });

    } catch (mailErr) {
      // Log but do not block response
      console.error('Failed to send career consultation confirmation email:', mailErr);
    }

    res.status(201).json({
      success: true,
      data: contact
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Delete clinic point
 * @route DELETE /api/clinic-points/:id
 */
const deleteContact = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findByPk(id);

    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    await contact.destroy();

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getContacts,
  getContactById,
  createContact,
  deleteContact
};