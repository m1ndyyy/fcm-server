const express = require('express');
const admin = require('firebase-admin');
const app = express();

const serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log('✅ Firebase инициализирован');

// ПРОВЕРКА: слушаем ВСЕ коллекции messages
db.collectionGroup('messages').onSnapshot((snapshot) => {
  console.log('🔔 Слушатель сработал! Новых сообщений:', snapshot.docChanges().length);
  
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const message = change.doc.data();
      console.log('📩 НОВОЕ СООБЩЕНИЕ:', message.text);
      
      try {
        const userRef = db.collection('users').doc(message.receiverId);
        const userDoc = await userRef.get();
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
          
          await admin.messaging().send(payload);
          console.log('✅ Уведомление отправлено!');
        } else {
          console.log('❌ Нет токена у получателя');
        }
      } catch (err) {
        console.error('❌ Ошибка:', err.message);
      }
    }
  });
});

app.get('/', (req, res) => res.send('Сервер работает!'));
app.listen(3000, () => console.log('🚀 Запущен на порту 3000'));