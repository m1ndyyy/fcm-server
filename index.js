const express = require('express');
const admin = require('firebase-admin');
const app = express();

const serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log('✅ Firebase инициализирован');

// Хранилище статусов "в чате" (временное)
const userInChat = {};

// Слушаем изменения статуса пользователей (кто в каком чате)
db.collection('users').onSnapshot((snapshot) => {
  snapshot.docChanges().forEach((change) => {
    const userData = change.doc.data();
    const userId = change.doc.id;
    if (userData.currentChatId) {
      userInChat[userId] = userData.currentChatId;
    } else {
      delete userInChat[userId];
    }
  });
});

db.collectionGroup('messages').onSnapshot(async (snapshot) => {
  console.log('🔔 Слушатель сработал! Новых сообщений:', snapshot.docChanges().length);
  
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const message = change.doc.data();
      console.log('📩 НОВОЕ СООБЩЕНИЕ:', message.text);
      
      // НЕ ОТПРАВЛЯЕМ, ЕСЛИ ПОЛЬЗОВАТЕЛЬ В ЭТОМ ЖЕ ЧАТЕ
      if (userInChat[message.receiverId] === change.doc.ref.parent.parent.id) {
        console.log('⏸️ Пользователь в чате, уведомление не отправлено');
        return;
      }
      
      // НЕ ОТПРАВЛЯЕМ САМОМУ СЕБЕ
      if (message.senderId === message.receiverId) {
        console.log('⏸️ Сообщение самому себе, пропускаем');
        return;
      }
      
      try {
        const userRef = db.collection('users').doc(message.receiverId);
        const userDoc = await userRef.get();
        const fcmToken = userDoc.data()?.fcmToken;
        
        if (!fcmToken) {
          console.log('❌ Нет токена у получателя');
          return;
        }
        
        // Получаем имя отправителя
        const senderRef = db.collection('users').doc(message.senderId);
        const senderDoc = await senderRef.get();
        const senderName = senderDoc.data()?.name || 'Пользователь';
        
        const payload = {
          data: {
            senderName: senderName,
            message: message.text,
            senderId: message.senderId,
            chatId: change.doc.ref.parent.parent.id
          },
          token: fcmToken
        };
        
        await admin.messaging().send(payload);
        console.log('✅ Уведомление отправлено!');
        
      } catch (err) {
        console.error('❌ Ошибка:', err.message);
      }
    }
  });
});

app.get('/', (req, res) => res.send('Сервер работает!'));
app.listen(3000, () => console.log('🚀 Запущен на порту 3000'));
