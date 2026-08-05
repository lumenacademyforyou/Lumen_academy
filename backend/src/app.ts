import express from 'express';
import cors from 'cors';
import schoolRoutes from './modules/school/school.routes';
import schoolAdminRoutes from './modules/school-admin/schoolAdmin.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Lumen Academy Backend Running 🚀",
  });
});

app.use('/api/schools', schoolRoutes);
app.use('/api/school-admins', schoolAdminRoutes);

app.use(errorHandler);

export default app;