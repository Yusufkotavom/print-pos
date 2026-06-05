import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { router } from "./init";
import { citiesRouter } from "./routers/cities";
import { companySettingsRouter } from "./routers/company-settings";
import { customersRouter } from "./routers/customers";
import { dashboardRouter } from "./routers/dashboard";
import { ordersRouter } from "./routers/orders";
import { paymentMethodsRouter } from "./routers/payment-methods";
import { productCategoriesRouter } from "./routers/product-categories";
import { productsRouter } from "./routers/products";
import { transactionsRouter } from "./routers/transactions";

export const appRouter = router({
	products: productsRouter,
	productCategories: productCategoriesRouter,
	customers: customersRouter,
	orders: ordersRouter,
	transactions: transactionsRouter,
	paymentMethods: paymentMethodsRouter,
	dashboard: dashboardRouter,
	companySettings: companySettingsRouter,
	cities: citiesRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
