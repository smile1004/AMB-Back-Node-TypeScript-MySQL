// controllers/chatController.ts
import { Request, Response, NextFunction } from 'express';
import db from '../models';
import { Op } from 'sequelize';

const { Chat, ChatBody, JobInfo, JobSeeker, Employer } = db;

// Get chat list for current user (employer or jobseeker)
const getUserChats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req;
    const isEmployer = user.role === 'employer';
    const whereCondition = isEmployer ? { employer_id: user.id } : { job_seeker_id: user.id };

    const chats = await Chat.findAll({
      where: whereCondition,
      include: [
        {
          model: ChatBody,
          as: 'messages',
          separate: true,
          order: [['created', 'DESC']],
          limit: 1, // get only latest message
        },
        {
          model: JobInfo,
          as: 'jobInfo',
          attributes: ['id', 'job_title'],
        },
      ],
    });

    // Add unread count per chat
    const chatListWithUnread = await Promise.all(
      chats.map(async (chat: any) => {
        const unreadCount = await ChatBody.count({
          where: {
            chat_id: chat.id,
            is_readed: 0,
            sender: { [Op.ne]: isEmployer ? 1 : 2 },
          },
        });
        return {
          ...chat.toJSON(),
          unreadCount,
        };
      })
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
          sender: { [Op.ne]: isEmployer ? 1 : 2 },
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
      order: [['created', 'ASC']],
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

export default {
  getChatMessages, markMessagesRead, getUserChats
}
