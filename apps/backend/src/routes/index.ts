import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import categoriesRouter from './categories';
import productsRouter from './products';
import homeRouter from './home';
import cartRouter from './cart';
import addressesRouter from './addresses';
import ordersRouter from './orders';
import orderPaymentsRouter from './orderPayments';
import orderTrackingRouter from './orderTracking';
import notificationsRouter from './notifications';
import adminRouter from './admin';
import staffRouter from './staff';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/categories', categoriesRouter);
router.use('/products', productsRouter);
router.use('/home', homeRouter);
router.use('/cart', cartRouter);
router.use('/addresses', addressesRouter);
router.use('/orders/:orderId/payments', orderPaymentsRouter);
router.use('/orders/:orderId/tracking', orderTrackingRouter);
router.use('/orders', ordersRouter);
router.use('/notifications', notificationsRouter);
router.use('/admin', adminRouter);
router.use('/staff', staffRouter);

// Future route mounts:
// router.use('/shipments', shipmentRouter);

export default router;
