export type PlanMonth = { forecast: number; supply: number };

export type PlanningRow = {
	model: string;
	product: string;
	category: string;
	launchDate: string;
	inventory: number;
	firstForecast: number;
	firstMass: number;
	months: Record<string, PlanMonth>;
};

export type HistoryRow = {
	month: string;
	model: string;
	product: string;
	category: string;
	forecast: number;
	actualSales: number;
	supplyPlan: number;
	actualSupply: number;
	beginningInventory: number;
	endingInventory: number;
};

export const initialPlanningMonths = ["2026-07", "2026-08", "2026-09", "2026-10"];

export const initialPlanningRows: PlanningRow[] = [
	{ model: "P61L-P2", product: "Pocket 10K 45W", category: "Power Bank", launchDate: "2026-01-15", inventory: 4000, firstForecast: 3500, firstMass: 5000, months: { "2026-07": { forecast: 1800, supply: 400 }, "2026-08": { forecast: 1700, supply: 400 }, "2026-09": { forecast: 1400, supply: 300 }, "2026-10": { forecast: 1600, supply: 500 } } },
	{ model: "P51L-P2", product: "Pocket 20K 45W", category: "Power Bank", launchDate: "2026-02-18", inventory: 11000, firstForecast: 8000, firstMass: 12000, months: { "2026-07": { forecast: 0, supply: 2000 }, "2026-08": { forecast: 1700, supply: 1200 }, "2026-09": { forecast: 1900, supply: 1400 }, "2026-10": { forecast: 2100, supply: 1600 } } },
	{ model: "PM61-Black", product: "MagPro Slim 10K Qi2.2 – Black", category: "Power Bank", launchDate: "2026-03-05", inventory: 6500, firstForecast: 2500, firstMass: 3500, months: { "2026-07": { forecast: 0, supply: 700 }, "2026-08": { forecast: 0, supply: 800 }, "2026-09": { forecast: 1200, supply: 900 }, "2026-10": { forecast: 1500, supply: 1000 } } },
	{ model: "PX51", product: "MagPro Neo 10K Qi2.0", category: "Power Bank", launchDate: "2026-08-22", inventory: 2200, firstForecast: 1800, firstMass: 2800, months: { "2026-07": { forecast: 0, supply: 600 }, "2026-08": { forecast: 1800, supply: 200 }, "2026-09": { forecast: 900, supply: 650 }, "2026-10": { forecast: 1300, supply: 900 } } },
	{ model: "WM321", product: "MagPro 3-in-1 Station", category: "Wireless Charger", launchDate: "2026-10-16", inventory: 2500, firstForecast: 1200, firstMass: 1600, months: { "2026-07": { forecast: 0, supply: 200 }, "2026-08": { forecast: 0, supply: 300 }, "2026-09": { forecast: 0, supply: 400 }, "2026-10": { forecast: 800, supply: 1000 } } },
	{ model: "WAL101", product: "Leopard Fold Charger 100W – EU", category: "Charger", launchDate: "2026-11-06", inventory: 400, firstForecast: 800, firstMass: 1000, months: { "2026-07": { forecast: 0, supply: 100 }, "2026-08": { forecast: 0, supply: 150 }, "2026-09": { forecast: 0, supply: 250 }, "2026-10": { forecast: 600, supply: 700 } } },
];

export const initialHistoryRows: HistoryRow[] = [
	{ month: "2026-01", model: "P61L-P2", product: "Pocket 10K 45W", category: "Power Bank", forecast: 0, actualSales: 0, supplyPlan: 420, actualSupply: 400, beginningInventory: 0, endingInventory: 400 },
	{ month: "2026-02", model: "P61L-P2", product: "Pocket 10K 45W", category: "Power Bank", forecast: 0, actualSales: 0, supplyPlan: 550, actualSupply: 550, beginningInventory: 400, endingInventory: 950 },
	{ month: "2026-03", model: "P61L-P2", product: "Pocket 10K 45W", category: "Power Bank", forecast: 20, actualSales: 20, supplyPlan: 700, actualSupply: 650, beginningInventory: 950, endingInventory: 1580 },
	{ month: "2026-04", model: "P61L-P2", product: "Pocket 10K 45W", category: "Power Bank", forecast: 40, actualSales: 30, supplyPlan: 760, actualSupply: 750, beginningInventory: 1580, endingInventory: 2300 },
	{ month: "2026-05", model: "P61L-P2", product: "Pocket 10K 45W", category: "Power Bank", forecast: 50, actualSales: 40, supplyPlan: 900, actualSupply: 850, beginningInventory: 2300, endingInventory: 3110 },
	{ month: "2026-06", model: "P61L-P2", product: "Pocket 10K 45W", category: "Power Bank", forecast: 80, actualSales: 60, supplyPlan: 1000, actualSupply: 950, beginningInventory: 3110, endingInventory: 4000 },
	{ month: "2026-02", model: "P51L-P2", product: "Pocket 20K 45W", category: "Power Bank", forecast: 0, actualSales: 0, supplyPlan: 1600, actualSupply: 1600, beginningInventory: 0, endingInventory: 1600 },
	{ month: "2026-03", model: "P51L-P2", product: "Pocket 20K 45W", category: "Power Bank", forecast: 0, actualSales: 0, supplyPlan: 1900, actualSupply: 1900, beginningInventory: 1600, endingInventory: 3500 },
	{ month: "2026-04", model: "P51L-P2", product: "Pocket 20K 45W", category: "Power Bank", forecast: 15, actualSales: 10, supplyPlan: 2200, actualSupply: 2200, beginningInventory: 3500, endingInventory: 5690 },
	{ month: "2026-05", model: "P51L-P2", product: "Pocket 20K 45W", category: "Power Bank", forecast: 25, actualSales: 20, supplyPlan: 2400, actualSupply: 2400, beginningInventory: 5690, endingInventory: 8070 },
	{ month: "2026-06", model: "P51L-P2", product: "Pocket 20K 45W", category: "Power Bank", forecast: 40, actualSales: 30, supplyPlan: 3000, actualSupply: 2960, beginningInventory: 8070, endingInventory: 11000 },
	{ month: "2026-03", model: "PM61-Black", product: "MagPro Slim 10K Qi2.2 – Black", category: "Power Bank", forecast: 0, actualSales: 0, supplyPlan: 1200, actualSupply: 1200, beginningInventory: 0, endingInventory: 1200 },
	{ month: "2026-04", model: "PM61-Black", product: "MagPro Slim 10K Qi2.2 – Black", category: "Power Bank", forecast: 5, actualSales: 5, supplyPlan: 1500, actualSupply: 1500, beginningInventory: 1200, endingInventory: 2695 },
	{ month: "2026-05", model: "PM61-Black", product: "MagPro Slim 10K Qi2.2 – Black", category: "Power Bank", forecast: 10, actualSales: 10, supplyPlan: 1850, actualSupply: 1800, beginningInventory: 2695, endingInventory: 4485 },
	{ month: "2026-06", model: "PM61-Black", product: "MagPro Slim 10K Qi2.2 – Black", category: "Power Bank", forecast: 20, actualSales: 15, supplyPlan: 2050, actualSupply: 2030, beginningInventory: 4485, endingInventory: 6500 },
];

export const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
