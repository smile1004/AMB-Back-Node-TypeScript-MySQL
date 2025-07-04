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
          where: isEmployer ? { employer_id: user.id } : undefined, // 🔥 filter for employer
          attributes: ['id', 'job_title', 'employer_id'],
          required: true, // ensures filter applies at JOIN level
        },
      ],
      where: isEmployer
        ? {} // employer filter is handled by jobInfo.employer_id
        : { job_seeker_id: user.id }, // 🔥 job seeker filter
    });

    // 🔁 Add unread count per chat
    const chatListWithUnread = await Promise.all(
      chats.map(async (chat: any) => {
        const unreadCount = await ChatBody.count({
          where: {
            chat_id: chat.id,
            is_readed: 0,
            sender: { [Op.ne]: isEmployer ? 1 : 2 }, // 1: employer, 2: seeker
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

    // 🧠 Sort chats by latest message time
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
