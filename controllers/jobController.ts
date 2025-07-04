import { Op, Sequelize, where, literal } from "sequelize";
import db from "../models";
const {
  ApplicationHistory,
  JobInfo,
  JobSeeker,
  DesiredCondition,
  JobInfosFeature,
  JobInfosRecruitingCriteria,
  Employer,
  EmploymentType,
  FavoriteJob,
  Feature,
  RecruitingCriteria,
  JobInfoClinicPoint,
  JobInfoStaffInfo,
  JobInfoWorkplaceIntroduction,
  ImagePath,
  JobAnalytic,
} = db;
import errorTypes from "../utils/errorTypes";
const { NotFoundError, BadRequestError, ForbiddenError } = errorTypes;
import log from "../utils/logger";
import upload from "../middleware/upload";
const { logger, httpLogger } = log;

/**
 * Get all jobs with optional filtering
 * @route GET /api/jobs
 */
const prefectureNameToIdJP: Record<string, number> = {
  "北海道": 1,
  "青森県": 2,
  "岩手県": 3,
  "宮城県": 4,
  "秋田県": 5,
  "山形県": 6,
  "福島県": 7,
  "茨城県": 8,
  "栃木県": 9,
  "群馬県": 10,
  "埼玉県": 11,
  "千葉県": 12,
  "東京都": 13,
  "神奈川県": 14,
  "新潟県": 15,
  "富山県": 16,
  "石川県": 17,
  "福井県": 18,
  "山梨県": 19,
  "長野県": 20,
  "岐阜県": 21,
  "静岡県": 22,
  "愛知県": 23,
  "三重県": 24,
  "滋賀県": 25,
  "京都府": 26,
  "大阪府": 27,
  "兵庫県": 28,
  "奈良県": 29,
  "和歌山県": 30,
  "鳥取県": 31,
  "島根県": 32,
  "岡山県": 33,
  "広島県": 34,
  "山口県": 35,
  "徳島県": 36,
  "香川県": 37,
  "愛媛県": 38,
  "高知県": 39,
  "福岡県": 40,
  "佐賀県": 41,
  "長崎県": 42,
  "熊本県": 43,
  "大分県": 44,
  "宮崎県": 45,
  "鹿児島県": 46,
  "沖縄県": 47
};
const getAllJobs = async (req: any, res: any, next: any) => {
  try {
    const {
      page = 1,
      limit = 10,
      employmentTypeId,
      employer_id,
      features,
      prefectures,
      searchTerm,
      companyID,
      isAdmin = "0",
      jobType = "0",
      sortBy = "created",
      sortOrder = "DESC",
    } = req.query;

    const offset = (page - 1) * limit;
    const whereCondition: any = { deleted: null };
    if (isAdmin == "0") whereCondition.public_status = 1;
    if (employmentTypeId) whereCondition.employment_type_id = employmentTypeId;
    if (companyID) whereCondition.employer_id = companyID;
    if (jobType && jobType != "0") whereCondition.job_detail_page_template_id = jobType;
    if (employer_id) whereCondition.employer_id = employer_id;
    if (searchTerm) {
      const prefectureId = prefectureNameToIdJP[searchTerm.trim()];
      whereCondition[Op.or] = [
        { job_title: { [Op.like]: `%${searchTerm}%` } },
        { job_lead_statement: { [Op.like]: `%${searchTerm}%` } },
        { short_appeal: { [Op.like]: `%${searchTerm}%` } },
        Sequelize.where(Sequelize.col("employer.clinic_name"), { [Op.like]: `%${searchTerm}%` }),
        Sequelize.where(Sequelize.col("employer.city"), { [Op.like]: `%${searchTerm}%` }),
        Sequelize.where(Sequelize.col("employer.closest_station"), { [Op.like]: `%${searchTerm}%` }),
      ];
      if (prefectureId) {
        whereCondition[Op.or].push(
          Sequelize.where(Sequelize.col("employer.prefectures"), { [Op.eq]: prefectureId })
        );
      }
    }

    const includeOptions = [
      {
        model: Employer,
        as: "employer",
        required: true,
        attributes: ["id", "clinic_name", "prefectures", "city", "closest_station"],
        where: {},
      },
      { model: EmploymentType, as: "employmentType" },
      {
        model: ImagePath,
        as: 'jobThumbnails',
        where: { posting_category: 11 },
        attributes: ["entity_path", "image_name"],
        required: false
      },
      {
        model: Feature,
        as: "features",
        through: { attributes: [] },
        required: true,
      },
    ];

    const featureIds = typeof features === "string" ? JSON.parse(features) : features || [];
    const prefectureIds = typeof prefectures === "string" ? JSON.parse(prefectures) : prefectures || [];

    const allFeatureIds = featureIds.map(Number);
    const orPrefectureFeatureIds = prefectureIds.map(Number).filter(id => id >= 35 && id <= 89);
    const andFeatureIds = allFeatureIds.filter(id => !orPrefectureFeatureIds.includes(id));

    if (andFeatureIds.length > 0 || orPrefectureFeatureIds.length > 0) {
      if (andFeatureIds.length > 0) {
        whereCondition[Op.and] = [
          ...(whereCondition[Op.and] || []),
          Sequelize.literal(`(
            SELECT COUNT(DISTINCT jf.feature_id)
            FROM job_infos_features AS jf
            WHERE jf.job_info_id = JobInfo.id
              AND jf.feature_id IN (${andFeatureIds.join(",")})
          ) = ${andFeatureIds.length}`),
        ];
      }

      if (orPrefectureFeatureIds.length > 0) {
        whereCondition[Op.and] = [
          ...(whereCondition[Op.and] || []),
          Sequelize.literal(`
            EXISTS (
              SELECT 1
              FROM job_infos_features AS jf
              WHERE jf.job_info_id = JobInfo.id
                AND jf.feature_id IN (${orPrefectureFeatureIds.join(",")})
            )
          `),
        ];
      }
    }

    const allJobs = await JobInfo.findAll({
      where: whereCondition,
      include: includeOptions,
      order: [[sortBy, sortOrder]],
      attributes: {
        include: [
          [Sequelize.literal(`(SELECT COALESCE(SUM(search_count), 0) FROM job_analytics AS ja WHERE ja.job_info_id = JobInfo.id)`), 'search_count'],
          [Sequelize.literal(`(SELECT COALESCE(SUM(recruits_count), 0) FROM job_analytics AS ja WHERE ja.job_info_id = JobInfo.id)`), 'recruits_count'],
          [Sequelize.literal(`(SELECT COUNT(*) FROM application_histories AS app WHERE app.job_info_id = JobInfo.id)`), 'application_count'],
          [Sequelize.literal(`(SELECT COUNT(*) FROM favorite_jobs AS fav WHERE fav.job_info_id = JobInfo.id)`), 'favourite_count'],
        ]
      }
    });

    const count = allJobs.length;
    const totalPages = Math.ceil(count / limit);

    // Highlight: Sort all filtered jobs by recommend_score if jobseeker
    let jobs = allJobs;
    if (req.user?.id && req.user?.role === 'jobseeker') {
      jobs = await Promise.all(jobs.map(async (job) => {
        const [analytic, applicationCount] = await Promise.all([
          JobAnalytic.findOne({ where: { job_info_id: job.id } }),
          ApplicationHistory.count({ where: { job_info_id: job.id } }),
        ]);
        const search = analytic?.search_count || 0;
        const recruits = analytic?.recruits_count || 0;
        const recommend_score = search * 0.3 + recruits * 0.3 + applicationCount * 4;
        return { ...job.get(), recommend_score };
      }));
      jobs.sort((a, b) => b.recommend_score - a.recommend_score);
    }

    const paginatedJobs = jobs.slice(offset, offset + parseInt(limit, 10));
    const recommendedJobs = jobs.slice(0, 5); // top 5 recommended FROM filtered result

    res.status(200).json({
      success: true,
      data: {
        jobs: paginatedJobs,
        recommended: recommendedJobs,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages,
        },
      },
    });

    try {
      for (const job of paginatedJobs) {
        const existing = await JobAnalytic.findOne({ where: { job_info_id: job.id } });
        if (existing) {
          existing.search_count += 1;
          await existing.save();
        } else {
          await JobAnalytic.create({ job_info_id: job.id, search_count: 1, recruits_count: 0 });
        }
      }
    } catch (analyticsError) {
      logger.error("Error updating job analytics:", analyticsError);
    }
  } catch (error) {
    next(error);
  }
};


/**
 * Get job by ID
 * @route GET /api/jobs/:id
 */
const getJobById = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    // Get job with all relations
    const job = await JobInfo.findByPk(id, {
      include: [
        {
          model: Employer,
          as: "employer",
          attributes: [
            "id",
            "clinic_name",
            "clinic_name_kana",
            "business_form",
            "zip",
            "prefectures",
            "city",
            "closest_station",
            "tel",
            "home_page_url",
            "access",
            "director_name",
            "employee_number",
            "establishment_year",
            "business",
            "capital_stock",
          ],
        },
        {
          model: EmploymentType,
          as: "employmentType",
        },
        {
          model: Feature,
          as: "features",
          through: { attributes: [] },
        },
        {
          model: RecruitingCriteria,
          as: "recruitingCriterias",
          through: {
            attributes: ["body", "public_status"],
            where: { public_status: 1 },
          },
        },
        {
          model: JobInfoClinicPoint,
          as: "clinicPoints",
        },
        {
          model: JobInfoStaffInfo,
          as: "staffInfos",
          include: [
            {
              model: ImagePath,
              as: 'images',
              attributes: ["entity_path", "image_name"],
              where: { posting_category: 14 },
              required: false
            }
          ],
          order: [["order_by", "ASC"]],
        },
        {
          model: JobInfoWorkplaceIntroduction,
          as: "workplaceIntroductions",
          include: [
            {
              model: ImagePath,
              as: 'images',
              attributes: ["entity_path", "image_name"],
              where: { posting_category: 13 },
              required: false
            }
          ]
        },
        {
          model: ImagePath,
          as: 'jobThumbnails',
          where: { posting_category: 11 },
          attributes: ["entity_path", "image_name"],
          required: false
        }
      ],
    });

    if (!job || job.deleted) {
      throw new NotFoundError("Job not found");
    }
    // Return response
    res.status(200).json({
      success: true,
      data: job,
    });


    // Update analytics asynchronously (non-blocking)
    try {
      const existing = await JobAnalytic.findOne({
        where: { job_info_id: job.id },
      });

      if (existing) {
        // Record exists – increment search_count
        existing.recruits_count += 1;
        await existing.save();
      } else {
        // No record – create new with search_count = 1
        await JobAnalytic.create({
          job_info_id: job.id,
          search_count: 0,
          recruits_count: 1, // Optional default
        });
      }
    } catch (analyticsError) {
      logger.error("Error updating job analytics:", analyticsError);
      // Continue response flow, don't fail if analytics fails
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new job
 * @route POST /api/jobs
 */
const createJob = async (req: any, res: any, next: any) => {
  try {
    // const employer_id = req.user.id;
    const employer_id = req.user.role === 'admin' ? req.body.employer_id : req.user.id;
    // Create job
    const job = await JobInfo.create({
      ...req.body,
      employer_id,
      job_posting_date: new Date(),
    });

    // Save job thumbnail image (posting_category = 11)
    if (req.files?.thumbnail && req.files.thumbnail.length > 0) {
      const file = req.files.thumbnail[0];
      const imageName = file.key.replace(/^uploaded\//, '');
      await ImagePath.create({
        image_name: imageName,
        entity_path: `/uploaded/${imageName}`,
        posting_category: 11,
        parent_id: job.id,
      });
    } else if (req.body?.thumbnail) {
      const fileName = req.body.thumbnail;
      await ImagePath.create({
        image_name: fileName,
        entity_path: `/uploaded/${fileName}`,
        posting_category: 11,
        parent_id: job.id,
      });
    }

    // ________________________ ADD FEATURES _______________________
    const features = typeof req.body.features === "string" ? JSON.parse(req.body.features) : req.body.features;

    // Ensure features is an array
    if (!Array.isArray(features)) {
      throw new Error("Features must be an array of feature IDs.");
    }

    // Validate that provided feature IDs exist
    const existingFeatures = await Feature.findAll({
      where: { id: features },
    });

    const validFeatureIds = existingFeatures.map((feature) => feature.id);

    if (validFeatureIds.length !== features.length) {
      throw new Error("Some features provided do not exist in the database.");
    }

    // Bulk insert job-feature associations
    if (validFeatureIds.length > 0) {
      const featuresToInsert = validFeatureIds.map((featureID) => ({
        job_info_id: job.id,
        feature_id: featureID,
      }));

      await JobInfosFeature.bulkCreate(featuresToInsert);
    }

    // ________________________ ADD RECRUITING_CRITERIAS _______________________

    const recruitingCriterias = typeof req.body.recruitingCriterias === "string" ? JSON.parse(req.body.recruitingCriterias) : req.body.recruitingCriterias;

    // Ensure features is an array
    if (!Array.isArray(recruitingCriterias)) {
      throw new Error("RecruitingCriterias must be an array");
    }

    // Bulk insert job-feature associations
    if (recruitingCriterias.length > 0) {
      const recruitingCriteriasInsert = recruitingCriterias.map((rc) => ({
        job_info_id: job.id,
        recruiting_criteria_id: rc.id,
        body: rc.body,
        public_status: rc.public_status || 1,
      }));

      await JobInfosRecruitingCriteria.bulkCreate(recruitingCriteriasInsert);
    }

    // ________________________ ADD STAFF_INFOS _______________________
    const staffInfos = typeof req.body.staffInfos === "string" ? JSON.parse(req.body.staffInfos) : req.body.staffInfos;
    if (!Array.isArray(staffInfos)) {
      throw new Error("staffInfos must be an array");
    }

    if (staffInfos.length > 0) {
      let fileindex = 0;
      let stringindex = 0;
      for (const [index, staff] of staffInfos.entries()) {
        const newStaff = await JobInfoStaffInfo.create({ ...staff, job_info_id: job.id });

        const uploadedImage = req.files?.staffImages?.[fileindex];
        let existingFilename;
        if (typeof (req.body.staffImages) == "string" && stringindex == 0)
          existingFilename = req.body?.staffImages;
        else if (typeof (req.body.staffImages) == "object")
          existingFilename = req.body?.staffImages?.[stringindex];


        if (staff.type == "object" && uploadedImage != undefined) {
          const imageName = uploadedImage.key.replace(/^uploaded\//, '');
          await ImagePath.create({
            image_name: imageName,
            entity_path: `/uploads/${imageName}`,
            posting_category: 14,
            parent_id: newStaff.id,
          });
          fileindex++;
        } else if (staff.type == 'string') {
          await ImagePath.create({
            image_name: existingFilename,
            entity_path: `/uploads/${existingFilename}`,
            posting_category: 14,
            parent_id: newStaff.id,
          });
          stringindex++;
        }
      }
    }

    // ________________________ ADD WORKPLACE_INTRODUCTIONS _______________________
    const workplaceIntroductions = typeof req.body.workplaceIntroductions === "string" ? JSON.parse(req.body.workplaceIntroductions) : req.body.workplaceIntroductions;

    if (Array.isArray(workplaceIntroductions) && workplaceIntroductions.length > 0) {
      let fileindex = 0;
      let stringindex = 0;
      for (const [index, intro] of workplaceIntroductions.entries()) {
        const newintro = await JobInfoWorkplaceIntroduction.create({ ...intro, job_info_id: job.id });

        const uploadedImage = req.files?.introImages?.[fileindex];
        let existingFilename;
        if (typeof (req.body.introImages) == "string" && stringindex == 0)
          existingFilename = req.body?.introImages;
        else if (typeof (req.body.introImages) == "object")
          existingFilename = req.body?.introImages?.[stringindex];

        if (intro.type == "object" && uploadedImage != undefined) {
          const imageName = uploadedImage.key.replace(/^uploaded\//, '');
          await ImagePath.create({
            image_name: imageName,
            entity_path: `/uploads/${imageName}`,
            posting_category: 13,
            parent_id: newintro.id,
          });
          fileindex++;
        } else if (intro.type == 'string') {
          await ImagePath.create({
            image_name: existingFilename,
            entity_path: `/uploads/${existingFilename}`,
            posting_category: 13,
            parent_id: newintro.id,
          });
          stringindex++;
        }
      }
    }

    // ________________________ ADD CLINIC_POINTS _______________________
    if (req.body.clinicPoints && req.body.clinicPoints.length > 0) {
      for (const point of req.body.clinicPoints) {
        await JobInfoClinicPoint.create({
          job_info_id: job.id,
          title: point.title,
          description: point.description,
        });
      }
    }
    // Get the created job with all relations
    const createdJob = await JobInfo.findByPk(job.id, {
      include: [
        {
          model: Employer,
          as: "employer",
          attributes: ["id", "clinic_name"],
        },
        {
          model: EmploymentType,
          as: "employmentType",
        },
        {
          model: Feature,
          as: "features",
          through: { attributes: [] },
        },
        {
          model: RecruitingCriteria,
          as: "recruitingCriterias",
          through: { attributes: [] },
        },
        {
          model: JobInfoStaffInfo,
          as: "staffInfos",
          order: [["order_by", "ASC"]],
        },
        {
          model: JobInfoWorkplaceIntroduction,
          as: "workplaceIntroductions",
        },
      ],
    });

    // Return response
    res.status(201).json({
      success: true,
      data: createdJob,
    });
  } catch (error: any) {
    console.error("Error in createJob:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * Update job by ID
 * @route PUT /api/jobs/:id
 */
const updateJob = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    // const employer_id = req.user.id;
    const employer_id = req.user.role === 'admin' ? req.body.employer_id : req.user.id;
    // Find job
    const job = await JobInfo.findByPk(id);

    if (!job) {
      throw new NotFoundError("Job not found");
    }


    // Check if the employer owns the job
    if (job.employer_id != employer_id) {
      // @ts-expect-error TS(2304): Cannot find name 'ForbiddenError'.
      throw new ForbiddenError("You do not have permission to update this job");
    }

    // Update job
    await job.update(req.body);

    // ________________________ ADD FEATURES _______________________
    const features = typeof req.body.features === "string" ? JSON.parse(req.body.features) : req.body.features;

    // Ensure features is an array
    if (!Array.isArray(features)) {
      throw new Error("Features must be an array of feature IDs.");
    }
    // Validate that provided feature IDs exist
    const existingFeatures = await Feature.findAll({
      where: { id: features },
    });

    const validFeatureIds = existingFeatures.map((feature) => feature.id);

    if (validFeatureIds.length !== features.length) {
      throw new Error("Some features provided do not exist in the database.");
    }
    if (features.length > 0) {
      await JobInfosFeature.destroy({
        where: { job_info_id: job.id },
      })
      // Bulk insert job-feature associations
      if (validFeatureIds.length > 0) {
        const featuresToInsert = validFeatureIds.map((featureID) => ({
          job_info_id: job.id,
          feature_id: featureID,
        }));

        await JobInfosFeature.bulkCreate(featuresToInsert);
      }
    }

    // ______________________UPDATE Criterias_____________________
    const recruitingCriterias = typeof req.body.recruitingCriterias === "string" ? JSON.parse(req.body.recruitingCriterias) : req.body.recruitingCriterias;

    // Ensure features is an array
    if (!Array.isArray(recruitingCriterias)) {
      throw new Error("RecruitingCriterias must be an array");
    }
    if (recruitingCriterias) {
      // Remove existing criteria first
      // @ts-expect-error TS(2304): Cannot find name 'models'.
      await JobInfosRecruitingCriteria.destroy({
        where: { job_info_id: job.id },
      });

      // Bulk insert job-feature associations
      if (recruitingCriterias.length > 0) {
        const recruitingCriteriasInsert = recruitingCriterias.map((rc) => ({
          job_info_id: job.id,
          recruiting_criteria_id: rc.id,
          body: rc.body,
          public_status: rc.public_status || 1,
        }));

        await JobInfosRecruitingCriteria.bulkCreate(recruitingCriteriasInsert);
      }
    }
    // ________________________ UPDATE CLINIC_POINTS _______________________
    if (req.body.clinicPoints) {
      // Remove existing clinic points first
      await JobInfoClinicPoint.destroy({
        where: { job_info_id: job.id },
      });

      // Add new clinic points
      if (req.body.clinicPoints && req.body.clinicPoints.length > 0) {
        for (const point of req.body.clinicPoints) {
          await JobInfoClinicPoint.create({
            job_info_id: job.id,
            title: point.title,
            description: point.description,
          });
        }
      }
    }

    // Save job thumbnail image (posting_category = 11)
    if (req.files?.thumbnail && req.files.thumbnail.length > 0) {

      const file = req.files.thumbnail[0];
      const imageName = file.key.replace(/^uploaded\//, '');
      await ImagePath.create({
        image_name: imageName,
        entity_path: `/uploads/${imageName}`,
        posting_category: 11,
        parent_id: job.id,
      });
    } else if (req.body?.thumbnail) {
      const fileName = req.body.thumbnail;
      await ImagePath.create({
        image_name: fileName,
        entity_path: `/uploads/${fileName}`,
        posting_category: 11,
        parent_id: job.id,
      });
    }

    // ___________UPDATE STAFF_INFO and WORKPLACE_____________________________________
    const staffInfos = typeof req.body.staffInfos === "string" ? JSON.parse(req.body.staffInfos) : req.body.staffInfos;
    const workplaceIntroductions = typeof req.body.workplaceIntroductions === "string" ? JSON.parse(req.body.workplaceIntroductions) : req.body.workplaceIntroductions;

    await JobInfoStaffInfo.destroy({ where: { job_info_id: job.id } }); // Clear old ones first

    let fileindex = 0;
    let stringindex = 0;
    for (const [index, staff] of staffInfos.entries()) {
      const newStaff = await JobInfoStaffInfo.create({ ...staff, job_info_id: job.id });

      const uploadedImage = req.files?.staffImages?.[fileindex];
      let existingFilename;
      if (typeof (req.body.staffImages) == "string" && stringindex == 0)
        existingFilename = req.body?.staffImages;
      else if (typeof (req.body.staffImages) == "object")
        existingFilename = req.body?.staffImages?.[stringindex];

      if (staff.type == "object" && uploadedImage != undefined) {
        const imageName = uploadedImage.key.replace(/^uploaded\//, '');
        await ImagePath.create({
          image_name: imageName,
          entity_path: `/uploads/${uploadedImage.imageName}`,
          posting_category: 14,
          parent_id: newStaff.id,
        });
        fileindex++;
      } else if (staff.type == 'string') {
        await ImagePath.create({
          image_name: existingFilename,
          entity_path: `/uploads/${existingFilename}`,
          posting_category: 14,
          parent_id: newStaff.id,
        });
        stringindex++;
      }
    }

    await JobInfoWorkplaceIntroduction.destroy({ where: { job_info_id: job.id } });


    fileindex = 0;
    stringindex = 0;
    for (const [index, intro] of workplaceIntroductions.entries()) {
      const newintro = await JobInfoWorkplaceIntroduction.create({ ...intro, job_info_id: job.id });

      const uploadedImage = req.files?.introImages?.[fileindex];
      let existingFilename;
      if (typeof (req.body.introImages) == "string" && stringindex == 0)
        existingFilename = req.body?.introImages;
      else if (typeof (req.body.introImages) == "object")
        existingFilename = req.body?.introImages?.[stringindex];

      if (intro.type == "object" && uploadedImage != undefined) {
        const imageName = uploadedImage.key.replace(/^uploaded\//, '');
        await ImagePath.create({
          image_name: imageName,
          entity_path: `/uploads/${imageName}`,
          posting_category: 13,
          parent_id: newintro.id,
        });
        fileindex++;
      } else if (intro.type == 'string') {
        await ImagePath.create({
          image_name: existingFilename,
          entity_path: `/uploads/${existingFilename}`,
          posting_category: 13,
          parent_id: newintro.id,
        });
        stringindex++;
      }
    }


    // for (const [index, intro] of workplaceIntroductions.entries()) {
    //   const newIntro = await JobInfoWorkplaceIntroduction.create({ ...intro, job_info_id: job.id });

    //   const uploadedImage = req.files?.introImages?.[index];
    //   const existingFilename = intro.image_name;

    //   if (uploadedImage) {
    //     await ImagePath.create({
    //       image_name: uploadedImage.filename,
    //       entity_path: `/uploads/${uploadedImage.filename}`,
    //       posting_category: 13,
    //       parent_id: newIntro.id,
    //     });
    //   } else if (existingFilename) {
    //     await ImagePath.create({
    //       image_name: existingFilename,
    //       entity_path: `/uploads/${existingFilename}`,
    //       posting_category: 13,
    //       parent_id: newIntro.id,
    //     });
    //   }
    // }


    // Get the updated job with all relations
    const updatedJob = await JobInfo.findByPk(job.id, {
      include: [
        {
          model: Employer,
          as: "employer",
          attributes: ["id", "clinic_name"],
        },
        {
          model: EmploymentType,
          as: "employmentType",
        },
        {
          model: Feature,
          as: "features",
          through: { attributes: [] },
        },
        {
          model: RecruitingCriteria,
          as: "recruitingCriterias",
          through: { attributes: ["body", "public_status"] },
        },
        {
          model: JobInfoClinicPoint,
          as: "clinicPoints",
        },
        {
          model: JobInfoStaffInfo,
          as: "staffInfos",
          order: [["order_by", "ASC"]],
        },
        {
          model: JobInfoWorkplaceIntroduction,
          as: "workplaceIntroductions",
        },
      ],
    });

    // Return response
    res.status(200).json({
      success: true,
      data: updatedJob,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete job by ID (soft delete)
 * @route DELETE /api/jobs/:id
 */
const deleteJob = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const employer_id = req.user.role === 'admin' ? "admin" : req.user.id;

    // Find job
    const job = await JobInfo.findByPk(id);

    if (!job) {
      throw new NotFoundError("Job not found");
    }
    // Check if the employer owns the job
    if (req.user.role !== 'admin' && job.employer_id != employer_id) {
      throw new ForbiddenError("You do not have permission to delete this job");
    }

    // Soft delete the job
    await job.update({
      deleted: new Date(),
      // public_status: 0,
    });

    // Return response
    res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get featured jobs
 * @route GET /api/jobs/featured
 */
const getFeaturedJobs = async (req: any, res: any, next: any) => {
  try {
    const { limit = 5 } = req.query;

    // Build where condition for jobs with featured tag
    const whereCondition = {
      deleted: null,
      public_status: 1,
    };

    // Find featured job IDs
    const jobInfoFeatureRows = await JobInfosFeature.findAll({
      attributes: ["job_info_id"],
      include: [
        {
          model: Feature,
          as: "feature",
          where: {
            name: { [Op.like]: "%featured%" }, // This is an example, adjust based on your data
          },
        },
      ],
    });
    const featuredJobIds = jobInfoFeatureRows.map(
      (item: any) => item.job_info_id
    );

    // Find jobs by IDs with all relations
    const featuredJobs = await JobInfo.findAll({
      where: {
        ...whereCondition,
        id: { [Op.in]: featuredJobIds },
      },
      include: [
        {
          model: Employer,
          as: "employer",
          attributes: ["id", "clinic_name", "city", "prefectures"],
        },
        {
          model: EmploymentType,
          as: "employmentType",
        },
        {
          model: Feature,
          as: "features",
          through: { attributes: [] },
        },
        {
          model: ImagePath,
          as: "images",
          limit: 1,
        },
      ],
      limit: parseInt(limit, 10),
      order: [["created", "DESC"]],
    });

    // Return response
    res.status(200).json({
      success: true,
      data: featuredJobs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get job recommendations for a job seeker
 * @route GET /api/jobs/recommendations
 */
// const getRecommendedJobs = async (req: any, res: any, next: any) => {
//   try {
//     const { id: jobSeekerId } = req.user;
//     const { limit = 10 } = req.query;

//     // Get job seeker with relations to find preferences
//     const jobSeeker = await JobSeeker.findByPk(jobSeekerId, {
//       include: [
//         {
//           model: EmploymentType,
//           as: "employmentTypes",
//           through: { attributes: [] },
//         },
//         {
//           model: DesiredCondition,
//           as: "desiredConditions",
//           through: { attributes: [] },
//         },
//       ],
//     });

//     if (!jobSeeker) {
//       throw new NotFoundError("Job seeker not found");
//     }

//     // Extract preferences
//     const employmentTypeIds = jobSeeker.employmentTypes.map(
//       (type: any) => type.id
//     );
//     const desiredConditionIds = jobSeeker.desiredConditions.map(
//       (condition: any) => condition.id
//     );
//     const preferredPrefectures = jobSeeker.prefectures;

//     // Build recommendation query
//     const whereCondition = {
//       deleted: null,
//       public_status: 1,
//     };

//     // Add employment type filter if available
//     if (employmentTypeIds.length > 0) {
//       // @ts-expect-error TS(2339): Property 'employment_type_id' does not exist on ty... Remove this comment to see the full error message
//       whereCondition.employment_type_id = {
//         [Op.in]: employmentTypeIds,
//       };
//     }

//     // Build include options
//     const includeOptions = [
//       {
//         model: Employer,
//         as: "employer",
//         attributes: [
//           "id",
//           "clinic_name",
//           "prefectures",
//           "city",
//           "closest_station",
//         ],
//         where: {},
//       },
//       {
//         model: EmploymentType,
//         as: "employmentType",
//       },
//       {
//         model: Feature,
//         as: "features",
//         through: { attributes: [] },
//       },
//       // {
//       //   model: ImagePath,
//       //   as: "images",
//       //   limit: 1,
//       // },
//     ];

//     // // Add prefectures filter to employer if available
//     if (preferredPrefectures) {
//       // @ts-expect-error TS(2532): Object is possibly 'undefined'.
//       includeOptions[0].where.prefectures = preferredPrefectures;
//     }

//     // // Add feature filter for desired conditions if available
//     // if (desiredConditionIds.length > 0) {
//     //   const featuresInclude = includeOptions.find(
//     //     (inc) => inc.as === "features"
//     //   );
//     //   // @ts-expect-error TS(2532): Object is possibly 'undefined'.
//     //   featuresInclude.where = {
//     //     id: {
//     //       [Op.in]: await Feature.findAll({
//     //         attributes: ["id"],
//     //         where: {
//     //           name: {
//     //             [Op.in]: await DesiredCondition.findAll({
//     //               attributes: ["name"],
//     //               where: { id: { [Op.in]: desiredConditionIds } },
//     //             }).map((dc: any) => dc.name),
//     //           },
//     //         },
//     //       }).map((f: any) => f.id),
//     //     },
//     //   };
//     //   // @ts-expect-error TS(2532): Object is possibly 'undefined'.
//     //   featuresInclude.required = false;
//     // }

//     // Get recommended jobs
//     const jobs = await JobInfo.findAll({
//       where: whereCondition,
//       include: includeOptions,
//       limit: parseInt(limit, 10),
//       order: [["created", "DESC"]],
//     });

//     // Return response
//     res.status(200).json({
//       success: true,
//       data: jobs,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

const getRecommendedJobs = async (req: any, res: any, next: any) => {
  try {
    const { id: jobSeekerId } = req.user;
    const { limit = 10 } = req.query;

    const jobSeeker = await JobSeeker.findByPk(jobSeekerId, {
      include: [
        { model: EmploymentType, as: "employmentTypes", through: { attributes: [] } },
        { model: DesiredCondition, as: "desiredConditions", through: { attributes: [] } },
      ],
    });

    if (!jobSeeker) throw new NotFoundError("Job seeker not found");

    const employmentTypeIds = jobSeeker.employmentTypes.map((t: any) => t.id);
    const preferredPrefectures = jobSeeker.prefectures;

    const whereCondition: any = {
      deleted: null,
      public_status: 1,
    };

    // Uncomment if you want to filter by employment types
    // if (employmentTypeIds.length > 0) {
    //   whereCondition.employment_type_id = { [Op.in]: employmentTypeIds };
    // }

    const jobs = await JobInfo.findAll({
      where: whereCondition,
      include: [
        {
          model: Employer,
          as: "employer",
          attributes: ["id", "clinic_name", "prefectures", "city", "closest_station"],
          // *** Filter by prefecture if available ***
          where: preferredPrefectures ? { prefectures: preferredPrefectures } : undefined,
        },
        {
          model: EmploymentType,
          as: "employmentType",
        },
        {
          model: Feature,
          as: "features",
          through: { attributes: [] },
        },
        {
          model: JobAnalytic,
          as: "job_analytics",  // *** Correct alias here ***
          attributes: [],   // We will include its fields explicitly below
        },
        {
          model: ApplicationHistory,
          as: "applications",
        },
      ],
      attributes: {
        include: [
          [Sequelize.col("job_analytics.search_count"), "search_count"],
          [Sequelize.col("job_analytics.recruits_count"), "recruits_count"],

          // <-- UPDATED: Use correlated subquery to get accurate application_count -->
          [
            Sequelize.literal(`(
        SELECT COUNT(*)
        FROM application_histories AS ah
        WHERE ah.job_info_id = JobInfo.id
      )`),
            "application_count"
          ],

          // Updated recommend_score using above count subquery result
          [
            Sequelize.literal(`
        COALESCE(job_analytics.search_count, 0) * 0.3 +
        COALESCE(job_analytics.recruits_count, 0) * 0.3 +
        (
          SELECT COUNT(*)
          FROM application_histories AS ah
          WHERE ah.job_info_id = JobInfo.id
        ) * 4
      `),
            "recommend_score"
          ],
        ],
      },
      // *** Group by all non-aggregated columns ***
      group: ["JobInfo.id", "employer.id", "employmentType.id", "job_analytics.id"],
      order: [[Sequelize.literal("recommend_score"), "DESC"]],
      limit: parseInt(limit, 10),
      subQuery: false,  // Important for correct grouping & limit
    });

    res.status(200).json({
      success: true,
      data: jobs,
    });

  } catch (error) {
    next(error);
  }
};



const addFavouriteJob = async (req: any, res: any, next: any) => {
  try {
    const job_seeker_id = req.user.id;
    const job_info_id = req.body.job_info_id;
    console.log(req.user.role)
    if (!job_info_id) {
      throw new Error("job_info_id is required");
    }

    // Check if already favorited
    const existingFavorite = await FavoriteJob.findOne({
      where: { job_seeker_id, job_info_id },
    });

    if (existingFavorite) {
      // If exists → remove (toggle off)
      await existingFavorite.destroy();

      return res.status(200).json({
        success: true,
        message: "Removed from your favourite jobs.",
        data: null,
      });
    }

    // Else → Create favorite (toggle on)
    const favouritejob = await FavoriteJob.create({ job_seeker_id, job_info_id });

    const createdfavouritejob = await FavoriteJob.findByPk(favouritejob.id, {
      include: [
        {
          model: JobSeeker,
          as: "jobSeeker",
          attributes: ["id", "name"],
        },
        {
          model: JobInfo,
          as: "jobInfo",
          attributes: ["id", "job_title"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Added to your favourite jobs.",
      data: createdfavouritejob,
    });
  } catch (error: any) {
    console.error("Error in addFavouriteJob:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


const getFavouriteJobs = async (req: any, res: any, next: any) => {
  try {
    const {
      page = 1,
      limit = 10,
      searchTerm,
      companyID,
      jobType = "0",
      sortBy = "created",
      sortOrder = "DESC",
    } = req.query;

    const { id: jobSeekerId } = req.user;

    const offset = (Number(page) - 1) * Number(limit);

    const favouriteWhereCondition: any = {
      job_seeker_id: jobSeekerId,
    };

    const jobInfoWhereCondition: any = {
      deleted: null,
    };

    if (jobType && jobType !== "0") {
      jobInfoWhereCondition.job_detail_page_template_id = jobType;
    }

    if (companyID) {
      jobInfoWhereCondition.employer_id = companyID;
    }

    // 🔧 Create employer where clause only if searchTerm exists
    const employerWhereCondition: any = {};
    if (searchTerm) {
      jobInfoWhereCondition[Op.or] = [
        { job_title: { [Op.like]: `%${searchTerm}%` } },
        { job_lead_statement: { [Op.like]: `%${searchTerm}%` } },
        { short_appeal: { [Op.like]: `%${searchTerm}%` } },
        { pay: { [Op.like]: `%${searchTerm}%` } },
      ];

      // 🔧 Move employer search inside its include
      employerWhereCondition[Op.or] = [
        { clinic_name: { [Op.like]: `%${searchTerm}%` } },
        { city: { [Op.like]: `%${searchTerm}%` } },
        { closest_station: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    const { count, rows: favouritejobs } = await FavoriteJob.findAndCountAll({
      where: favouriteWhereCondition,
      include: [
        {
          model: JobInfo,
          as: 'jobInfo',
          where: jobInfoWhereCondition,
          required: true,
          include: [
            {
              model: Employer,
              as: 'employer',
              attributes: ['id', 'clinic_name', 'city', 'closest_station'],
              ...(searchTerm && { where: employerWhereCondition }) // only apply if needed
            }
          ]
        }
      ],
      limit: Number(limit),
      offset,
      order: [[sortBy, sortOrder]],
    });

    const totalPages = Math.ceil(count / Number(limit));

    res.status(200).json({
      success: true,
      data: {
        favouritejobs,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages,
        },
      },
    });

  } catch (error) {
    next(error);
  }
};




export default {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getFeaturedJobs,
  getRecommendedJobs,
  addFavouriteJob,
  getFavouriteJobs
};