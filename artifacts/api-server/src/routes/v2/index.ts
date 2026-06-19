import { Router, type IRouter } from "express";
import clientDemandsRouter from "./client-demands";
import quotationCardsRouter from "./quotation-cards";
import contractsRouter from "./contracts";
import paymentPlansRouter from "./payment-plans";
import deliverablesARouter from "./deliverables-a";
import ticketsARouter from "./tickets-a";
import outsourceDemandsRouter from "./outsource-demands";
import tendersRouter from "./tenders";
import outsourceOrdersRouter from "./outsource-orders";
import settlementPlansRouter from "./settlement-plans";
import deliverablesBRouter from "./deliverables-b";
import ticketsBRouter from "./tickets-b";
import discussionsRouter from "./discussions";
import overviewRouter from "./overview";

const router: IRouter = Router();

router.use("/", clientDemandsRouter);
router.use("/", quotationCardsRouter);
router.use("/", contractsRouter);
router.use("/", paymentPlansRouter);
router.use("/", deliverablesARouter);
router.use("/", ticketsARouter);
router.use("/", outsourceDemandsRouter);
router.use("/", tendersRouter);
router.use("/", outsourceOrdersRouter);
router.use("/", settlementPlansRouter);
router.use("/", deliverablesBRouter);
router.use("/", ticketsBRouter);
router.use("/", discussionsRouter);
router.use("/", overviewRouter);

export default router;
