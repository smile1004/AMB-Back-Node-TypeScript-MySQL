// controllers/chatController.ts
import { Request, Response, NextFunction } from 'express';
import db from '../models';
import { Op } from 'sequelize';
import { is } from 'cheerio/dist/commonjs/api/traversing';

const { Chat, ChatBody, JobInfo, JobSeeker, Employer, ImagePath } = db;

// Get chat list for current user (employer or jobseeker)
const getUserChats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req;
    const isEmployer = user.role === 'employer';

    console.log("=====", isEmployer);
    const chats = await Chat.findAll({
      include: [
        {
          model: ChatBody,
          as: 'messages',
          separate: true,
          order: [['created', 'DESC']],
          limit: 1, // latest message only
        },
        {
          model: JobInfo,
          as: 'jobInfo',
          where: isEmployer ? { employer_id: user.id } : undefined,
          attributes: ['id', 'job_title', 'employer_id'],
          required: true,
          include: [
            {
              model: Employer,
              as: 'employer',
              attributes: ['id', 'clinic_name', 'prefectures', 'city'],
              include: [
                {
                  model: ImagePath,
                  as: 'avatar',
                  required: false,
                  where: { posting_category: 2 }, // 👤 employer avatar
                  attributes: ['entity_path'],
                },
              ],
            },
          ],
        },
        {
          model: JobSeeker,
          as: 'jobSeeker',
          attributes: ['id', 'name', 'email', 'sex', 'birthdate', 'prefectures', 'zip', 'tel'],
          include: [
            {
              model: ImagePath,
              as: 'avatar',
              required: false,
              where: { posting_category: 1 }, // 👤 job seeker avatar
              attributes: ['entity_path'],
            },
          ],
        },
      ],
      where: isEmployer
        ? {} // employer filter handled via jobInfo.employer_id
        : { job_seeker_id: user.id },
    });

    // 📨 Add unread count per chat
    const chatListWithUnread = await Promise.all(
      chats.map(async (chat: any) => {
        const unreadCount = await ChatBody.count({
          where: {
            chat_id: chat.id,
            is_readed: 0,
            sender: isEmployer ? 1 : 2,
          },
        });

        const latestMessage = chat.messages[0];
        return {
          ...chat.toJSON(),
          unreadCount,
          lastMessageTime: latestMessage?.created || chat.created,
        };
      })
    );

    // 📅 Sort by latest message time
    chatListWithUnread.sort(
      (a, b) =>
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    res.json({ success: true, data: chatListWithUnread });
  } catch (err) {
    next(err);
  }
};


// Mark messages as read
const markMessagesRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chatId = parseInt(req.params.chat_id);
    const { user } = req;
    const isEmployer = user.role === 'employer';

    await ChatBody.update(
      { is_readed: 1 },
      {
        where: {
          chat_id: chatId,
          is_readed: 0,
          sender: isEmployer ? 1 : 2,
        },
      }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// Get all messages for one chat room
const getChatMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat_id = parseInt(req.params.chat_id);
    const messages = await ChatBody.findAll({
      where: { chat_id: chat_id },
      order: [['created', 'DESC']],
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

export default {
  getChatMessages, markMessagesRead, getUserChats
}
