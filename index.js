const express = require('express');
const admin = require('firebase-admin');
const app = express();

const serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log('✅ Firebase инициализирован');

db.collectionGroup('messages').onSnapshot(async (snapshot) => {
  console.log('🔔 Новых сообщений:', snapshot.docChanges().length);
  
  for (const change of snapshot.docChanges()) {
    if (change.type === 'added') {
      const message = change.doc.data();
      console.log('📩 НОВОЕ СООБЩЕНИЕ:', message.text);
      
      if (message.senderId === message.receiverId) {
        console.log('⏸️ Сообщение самому себе');
        continue;
      }
      
      const receiverDoc = await db.collection('users').doc(message.receiverId).get();
      const currentChatId = receiverDoc.data()?.currentChatId;
      const chatId = change.doc.ref.parent.parent.id;
      
      if (currentChatId === chatId) {
        console.log('⏸️ Получатель уже в чате');
        continue;
      }
      
      const fcmToken = receiverDoc.data()?.fcmToken;
      if (!fcmToken) {
        console.log('❌ Нет токена');
        continue;
      }
      
      const senderDoc = await db.collection('users').doc(message.senderId).get();
      const senderName = senderDoc.data()?.name || 'Пользователь';
      
      const payload = {
        data: {
          senderName: senderName,
          message: message.text,
          senderId: message.senderId,
          chatId: chatId
        },
        token: fcmToken
      };
      
      await admin.messaging().send(payload);
      console.log('✅ Уведомление отправлено!');
    }
  }
});

app.get('/', (req, res) => res.send('Сервер работает!'));
app.listen(3000, () => console.log('🚀 Запущен на порту 3000'));
