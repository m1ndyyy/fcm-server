const express = require('express');
const admin = require('firebase-admin');
const app = express();

// Парсим JSON из переменной окружения
const serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log('✅ Firebase инициализирован');

// Эндпоинт для проверки
app.get('/', (req, res) => {
  res.send('Сервер работает!');
});

// Прослушиваем новые сообщения
db.collectionGroup('messages').onSnapshot((snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const message = change.doc.data();
      console.log('📩 Новое сообщение:', message.text);
      
      try {
        const userDoc = await db.collection('users').doc(message.receiverId).get();
        const fcmToken = userDoc.data()?.fcmToken;
        
        if (fcmToken) {
          const payload = {
            data: {
              senderName: 'Пользователь',
              message: message.text,
              senderId: message.senderId,
              chatId: change.doc.ref.parent.parent.id
            },
            token: fcmToken
          };
          
          const response = await admin.messaging().send(payload);
          console.log('✅ Уведомление отправлено:', response);
        } else {
          console.log('❌ Нет токена у получателя');
        }
      } catch (err) {
        console.error('❌ Ошибка:', err.message);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Запущен на порту ${PORT}`));