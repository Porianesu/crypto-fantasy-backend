import express from 'express';
import { PrismaClient } from '../../generated/prisma';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// 获取所有用户
app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: '获取用户失败' });
  }
});

// 新增用户
app.post('/users', async (req, res) => {
  const { username, password, avatar, solAsset } = req.body;
  try {
    const user = await prisma.user.create({
      data: { username, password, avatar, solAsset }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: '创建用户失败' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

