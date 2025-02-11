   // importData.js
   const mongoose = require('mongoose');
   const XLSX = require('xlsx');
   const User = require('./model/User'); // 確保路徑正確

   // 連接到 MongoDB
   mongoose.connect('mongodb+srv://icesolution19:jLuZY1Lbi5UQNtyz@cluster0.nky9l.mongodb.net/prud', {
       useNewUrlParser: true,
       useUnifiedTopology: true
   })
   .then(() => console.log('MongoDB 連接成功'))
   .catch(err => console.error('MongoDB 連接失敗:', err));
   
   // 讀取 XLSX 文件
   const workbook = XLSX.readFile('prud.xlsx'); // 替換為您的文件路徑
   
   const sheetName = workbook.SheetNames[0]; // 獲取第一個工作表
   const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
console.log(data);
   // 將數據轉換為符合 User 模型的格式
   const formattedData = data.map(item => ({
       uid: item.uid,
       email: item.email,
       name: item.name,
       broker_name: item.broker_name ? item.broker_name.trim() : '' // 修剪 broker_name // 注意這裡的拼寫修正
   }));

   // 將數據存入 MongoDB
   const importData = async () => {
       try {
           await User.insertMany(formattedData);
           console.log('數據導入成功');
       } catch (error) {
           console.error('數據導入失敗:', error);
       } finally {
           mongoose.connection.close(); // 關閉連接
       }
   };

   importData();