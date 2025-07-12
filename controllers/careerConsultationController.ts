import { Op } from 'sequelize';
import db from '../models';
const { CareerConsultation, JobInfo } = db;
import errorTypes from '../utils/errorTypes';
const { NotFoundError, BadRequestError, ForbiddenError } = errorTypes;

/**
 * Get all clinic points for a job
 * @route GET /api/jobs/:jobId/clinic-points
 */
const getCareerConsultations = async (req: any, res: any, next: any) => {
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
        { email: { [Op.like]: `%${searchTerm}%` } },
        { telephone: { [Op.like]: `%${searchTerm}%` } },
        { inquiry: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    const { count, rows: careerConsultations } = await CareerConsultation.findAndCountAll({
      where: whereCondition,
      limit: parseInt(limit, 10),
      offset: offset,
    });

    const totalPages = Math.ceil(count / limit);


    res.status(200).json({
      success: true,
      data: {
        careerConsultations,
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
const getCareerConsultationById = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    const careerConsultation = await CareerConsultation.findByPk(id);

    if (!careerConsultation) {
      throw new NotFoundError('CareerConsultation not found');
    }

    res.status(200).json({
      success: true,
      data: careerConsultation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create clinic point
 * @route POST /api/jobs/:jobId/clinic-points
 */
const createCareerConsultation = async (req: any, res: any, next: any) => {
  try {
    const { title, description } = req.body;

    const careerConsultation = await CareerConsultation.create(req.body);

    res.status(201).json({
      success: true,
      data: careerConsultation
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Delete clinic point
 * @route DELETE /api/clinic-points/:id
 */
const deleteCareerConsultation = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    const careerConsultation = await CareerConsultation.findByPk(id);

    if (!careerConsultation) {
      throw new NotFoundError('CareerConsultation not found');
    }

    await careerConsultation.destroy();

    res.status(200).json({
      success: true,
      message: 'CareerConsultation deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getCareerConsultations,
  getCareerConsultationById,
  createCareerConsultation,
  deleteCareerConsultation
};