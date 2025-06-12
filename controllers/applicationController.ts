import { Op } from 'sequelize';
import db from '../models';
const { ApplicationHistory, JobInfo, JobSeeker, Chat, ChatBody, Employer } = db;

import errorTypes from '../utils/errorTypes';
const { NotFoundError, BadRequestError, ForbiddenError } = errorTypes;

/**
 * Apply for a job
 * @route POST /api/applications
 */
const applyForJob = async (req: any, res: any, next: any) => {
  try {
    const { id: jobSeekerId } = req.user;
    const { job_info_id, application_message } = req.body;

    if (!job_info_id) {
      throw new BadRequestError('Job ID is required');
    }

    // Find job
    const job = await JobInfo.findByPk(job_info_id);

    if (!job || job.deleted || job.public_status !== 1) {
      throw new NotFoundError('Job not found or not active');
    }

    // Check if already applied
    const existingApplication = await ApplicationHistory.findOne({
      where: {
        job_info_id,
        job_seeker_id: jobSeekerId
      }
    });

    if (existingApplication) {
      throw new BadRequestError('You have already applied for this job');
    }

    // Create or get existing chat
    let chat = await Chat.findOne({
      where: {
        job_info_id,
        job_seeker_id: jobSeekerId
      }
    });

    if (!chat) {
      chat = await Chat.create({
        job_info_id,
        job_seeker_id: jobSeekerId,
        job_title: job.job_title,
        is_send_privacy: 0
      });
    }

    // Create application message
    const nextMessageNumber = (await ChatBody.count({
      where: { chat_id: chat.id }
    })) + 1;

    await ChatBody.create({
      chat_id: chat.id,
      no: nextMessageNumber,
      sender: 0, // 0 for job seeker
      body: application_message,
      is_readed: 0,
      mail_send: 0,
      chat_flg: 1  // 1 indicates this is an application message
    });

    // Create application record
    const application = await ApplicationHistory.create({
      job_info_id,
      job_seeker_id: jobSeekerId,
      job_title: job.job_title,
      chat_id: chat.id
    });

    // Return response
    res.status(201).json({
      success: true,
      data: application,
      message: 'Application submitted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getAllApplications = async (req: any, res: any, next: any) => {
  try {
    // Get all applications with job info
    const applications = await ApplicationHistory.findAll({
      include: [
        {
          model: JobSeeker,
          as: "jobSeeker",
        },
        {
          model: JobInfo,
          as: 'jobInfo',
          include: [
            {
              model: Employer,
              as: 'employer',
              attributes: ['id', 'clinic_name']
            }
          ]
        },
        {
          model: Chat,
          as: 'chat',
          include: [
            {
              model: ChatBody,
              as: 'messages',
              limit: 1,
              order: [['created', 'DESC']]
            }
          ]
        }
      ],
      order: [['created', 'DESC']]
    });

    // Return response
    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all applications for job seeker
 * @route GET /api/applications/job-seeker
 */
const getJobSeekerApplications = async (req: any, res: any, next: any) => {
  try {
    const { id: jobSeekerId } = req.user;

    // Get all applications with job info
    const applications = await ApplicationHistory.findAll({
      where: { job_seeker_id: jobSeekerId },
      include: [
        {
          model: JobInfo,
          as: 'jobInfo',
          include: [
            {
              model: Employer,
              as: 'employer',
              attributes: ['id', 'clinic_name']
            }
          ]
        },
        {
          model: Chat,
          as: 'chat',
          include: [
            {
              model: ChatBody,
              as: 'messages',
              limit: 1,
              order: [['created', 'DESC']]
            }
          ]
        }
      ],
      order: [['created', 'DESC']]
    });

    // Return response
    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all applications for employer's jobs
 * @route GET /api/applications/employer
 */
const getEmployerApplications = async (req: any, res: any, next: any) => {
  try {
    const { id: employerId } = req.user;

    // Get employer's job IDs
    const jobs = await JobInfo.findAll({
      attributes: ["id"],
      where: { employer_id: employerId },
      raw: true, // Ensures only plain data objects are returned
    });

    // Extract job IDs from results
    const jobIds = jobs.map((job: any) => job.id);


    if (jobIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    // Get all applications for employer's jobs
    const applications = await ApplicationHistory.findAll({
      where: { job_info_id: { [Op.in]: jobIds } },
      include: [
        {
          model: JobInfo,
          as: 'jobInfo',
          attributes: ['id', 'job_title']
        },
        {
          model: JobSeeker,
          as: 'jobSeeker',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Chat,
          as: 'chat',
          include: [
            {
              model: ChatBody,
              as: 'messages',
              limit: 1,
              order: [['created', 'DESC']]
            }
          ]
        }
      ],
      order: [['created', 'DESC']]
    });

    // Return response
    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get application details
 * @route GET /api/applications/:id
 */
const getApplicationById = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user;

    // Find application
    const application = await ApplicationHistory.findByPk(id, {
      include: [
        {
          model: JobInfo,
          as: 'jobInfo',
          include: [
            {
              model: Employer,
              as: 'employer',
              attributes: ['id', 'clinic_name']
            }
          ]
        },
        {
          model: JobSeeker,
          as: 'jobSeeker',
          attributes: ['id', 'name', 'email', 'tel', 'birthdate', 'prefectures']
        },
        {
          model: Chat,
          as: 'chat',
          include: [
            {
              model: ChatBody,
              as: 'messages',
              order: [['created', 'ASC']]
            }
          ]
        }
      ]
    });

    if (!application) {
      throw new NotFoundError('Application not found');
    }

    // Check access permissions
    if (
      (role === 'jobSeeker' && application.job_seeker_id !== userId) ||
      (role === 'employer' && application.jobInfo.employer_id !== userId)
    ) {
      throw new ForbiddenError('You do not have access to this application');
    }

    // Return response
    res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAllApplications,
  applyForJob,
  getJobSeekerApplications,
  getEmployerApplications,
  getApplicationById
};