// socketServer.ts
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import db from '../models';

const { ChatBody } = db;

let io: Server;

export const initSocketServer = (httpServer: HTTPServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      // methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('🔌 Connected:', socket.id);

    socket.on('join', (chatId: number) => {
      socket.join(`chat_${chatId}`);
      console.log(`✅ Joined chat room: chat_${chatId}`);
    });

    socket.on('message', async (data) => {
      const { chat_id, sender, body, file_path = '', file_name = '' } = data;

      try {
        const newMessage = await ChatBody.create({
          chat_id,
          sender,
          body,
          is_readed: 0,
          mail_send: 0,
          chat_flg: 0,
          file_path,
          file_name,
        });

        io.to(`chat_${chat_id}`).emit('newMessage', newMessage);
        console.log(`📩 Message sent to chat_${chat_id}:`, body);
      } catch (err) {
        console.error('❌ Message save failed:', err);
        socket.emit('errorMessage', 'Failed to send message');
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected:', socket.id);
    });
  });
};

export const getIO = () => io;
