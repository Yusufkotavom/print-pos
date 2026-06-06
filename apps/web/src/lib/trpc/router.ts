import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { router } from "./init";
import { citiesRouter } from "./routers/cities";
import { companySettingsRouter } from "./routers/company-settings";
import { customersRouter } from "./routers/customers";
import { dashboardRouter } from "./routers/dashboard";
import { financialReportsRouter } from "./routers/financial-reports";
import { ordersRouter } from "./routers/orders";
import { paymentMethodsRouter } from "./routers/payment-methods";
import { productCategoriesRouter } from "./routers/product-categories";
import { productsRouter } from "./routers/products";
import { serviceOrdersRouter } from "./routers/service-orders";
import { serviceTypesRouter } from "./routers/service-types";
import { transactionCategoriesRouter } from "./routers/transaction-categories";
import { transactionsRouter } from "./routers/transactions";

export const appRouter = router({
	products: productsRouter,
	productCategories: productCategoriesRouter,
	customers: customersRouter,
	orders: ordersRouter,
	serviceOrders: serviceOrdersRouter,
	serviceTypes: serviceTypesRouter,
	transactions: transactionsRouter,
	transactionCategories: transactionCategoriesRouter,
	paymentMethods: paymentMethodsRouter,
	dashboard: dashboardRouter,
	financialReports: financialReportsRouter,
	companySettings: companySettingsRouter,
	cities: citiesRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
