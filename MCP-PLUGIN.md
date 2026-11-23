# PC Storage MCP plugin

ปลั๊กอินนี้เชื่อม MCP เข้ากับ PC Storage sandbox ที่ `http://localhost:8094`

เครื่องมือที่เปิดให้ใช้ตอนนี้เป็นแบบอ่านอย่างเดียว:

- `pc_storage_health`
- `pc_storage_tree`
- `pc_storage_inventory`

ปลั๊กอินจะตัด token, secret, key, password, file content และ binary data ออกจากผลลัพธ์ก่อนส่งให้ MCP client

## การรัน

```powershell
npm install
npm run build
npm start
```

เครื่องมือที่อ่าน endpoint ที่มีการป้องกันต้องรับ token ผ่าน environment ของโปรเซสเท่านั้น:

```powershell
$env:PC_STORAGE_API_TOKEN = "<token อายุสั้นของ PC Storage API>"
npm start
```

ห้ามใส่ token ใน `package.json`, source code, Git หรือไฟล์ผลลัพธ์

ถ้าต้องการเปลี่ยน API URL ให้กำหนด `PC_STORAGE_API_URL` แต่ไม่ควรชี้ไปยัง public endpoint ใน sandbox

ยังไม่มี tool สำหรับลบหรือเขียนไฟล์ และยังไม่เชื่อม Microsoft Graph โดยตรงจนกว่าจะเพิ่ม authentication provider แยกต่างหาก

