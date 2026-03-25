import { Router, type IRouter } from "express";
import healthRouter from "./health";
import statsRouter from "./stats";
import usersRouter from "./users";
import demandsRouter from "./demands";
import bidsRouter from "./bids";
import ordersRouter from "./orders";
import portfoliosRouter from "./portfolios";
import notificationsRouter from "./notifications";
import authRouter from "./auth";
import postsRouter from "./posts";
import coursesRouter from "./courses";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(statsRouter);
router.use(usersRouter);
router.use(demandsRouter);
router.use(bidsRouter);
router.use(ordersRouter);
router.use(portfoliosRouter);
router.use(notificationsRouter);
router.use(postsRouter);
router.use(coursesRouter);
router.use(adminRouter);

export default router;
