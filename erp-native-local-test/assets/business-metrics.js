(function () {
  "use strict";

  const DATA = window.DATA || {};
  const FX = { EUR: 1, PLN: 0.233, CNY: 0.13 };
  const COLOR_WORDS = new Set(["black", "white", "orange", "blue", "titan", "deserttitan", "red", "lb", "b", "w", "t", "bu", "d", "o", "r"]);
  const countryById = Object.fromEntries((DATA.country || []).map((row) => [row.id, row]));
  const skuById = Object.fromEntries((DATA.sku || []).map((row) => [row.id, row]));
  const kaById = Object.fromEntries((DATA.ka || []).map((row) => [row.id, row]));
  const confirmedCache = new Map();
  const freightRecordByPo = Object.fromEntries((DATA.po_freight || []).map((row) => [normalizePo(row.po_number), row]));
  const freightByPo = Object.fromEntries((DATA.po_freight || []).map((row) => [normalizePo(row.po_number), toEur(row.delivery_fee, row.currency)]));

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function toEur(value, currency) {
    return number(value) * (FX[currency] || 1);
  }

  function normalizePo(value) {
    return String(value == null ? "" : value).replace(/\.0$/, "");
  }

  function stripColor(code) {
    const parts = String(code || "").split("-");
    if (parts.length > 1 && COLOR_WORDS.has(parts[parts.length - 1].toLowerCase())) parts.pop();
    return parts.join("-");
  }

  function activeCountries() {
    return (DATA.country || [])
      .filter((row) => row.is_active && row.region === "EU")
      .sort((a, b) => number(a.sort_order) - number(b.sort_order));
  }

  function isEffectivePo(row) {
    return String(row.po_status || "").toLowerCase() !== "cancelled";
  }

  function monthsForQuarter(year, quarter) {
    const start = (quarter - 1) * 3 + 1;
    return [0, 1, 2].map((offset) => `${year}-${String(start + offset).padStart(2, "0")}`);
  }

  function monthsForHalf(year, half) {
    const start = half === 2 ? 7 : 1;
    return Array.from({ length: 6 }, (_, offset) => `${year}-${String(start + offset).padStart(2, "0")}`);
  }

  function monthsForYear(year) {
    return Array.from({ length: 12 }, (_, offset) => `${year}-${String(offset + 1).padStart(2, "0")}`);
  }

  function monthsForPeriod(type, value) {
    if (type === "month") return [value];
    if (type === "half") {
      const match = /^(\d{4})-H([12])$/.exec(value);
      return match ? monthsForHalf(Number(match[1]), Number(match[2])) : [];
    }
    if (type === "year") return monthsForYear(Number(value));
    const match = /^(\d{4})-Q([1-4])$/.exec(value);
    return match ? monthsForQuarter(Number(match[1]), Number(match[2])) : [];
  }

  function periodLabel(type, value) {
    if (type === "month") {
      const [year, month] = String(value).split("-");
      return `${year}年${Number(month)}月`;
    }
    if (type === "half") return value.replace("-H", " H");
    if (type === "year") return `${value}年度`;
    return value.replace("-Q", " Q");
  }

  function poRows(months, scope) {
    const monthSet = new Set(months);
    return (DATA.channel_po || []).filter((row) => {
      if (!isEffectivePo(row) || !monthSet.has(String(row.po_date || "").slice(0, 7))) return false;
      if (!scope || scope === "ALL") return true;
      return (countryById[row.country_id] || {}).code === scope;
    });
  }

  function creditNotes(months, scope) {
    const monthSet = new Set(months);
    return (DATA.credit_note || []).filter((row) => {
      if (!monthSet.has(String(row.cn_date || "").slice(0, 7))) return false;
      if (!scope || scope === "ALL") return true;
      return (countryById[row.country_id] || {}).code === scope;
    });
  }

  function planValue(months, scope) {
    const monthSet = new Set(months.map((value) => Number(value.slice(5, 7))));
    const years = new Set(months.map((value) => Number(value.slice(0, 4))));
    return (DATA.business_plan || []).reduce((total, row) => {
      if (!years.has(Number(row.year)) || !monthSet.has(Number(row.month))) return total;
      if (scope && scope !== "ALL" && (countryById[row.country_id] || {}).code !== scope) return total;
      return total + number(row.si_value);
    }, 0);
  }

  function planQuantity(months, scope) {
    const monthSet = new Set(months.map((value) => Number(value.slice(5, 7))));
    const years = new Set(months.map((value) => Number(value.slice(0, 4))));
    return (DATA.business_plan_detail || []).reduce((total, row) => {
      if (!years.has(Number(row.year)) || !monthSet.has(Number(row.month))) return total;
      if (scope && scope !== "ALL" && (countryById[row.country_id] || {}).code !== scope) return total;
      return total + number(row.si_qty);
    }, 0);
  }

  function aggregate(months, scope) {
    const rows = poRows(months, scope);
    const poNumbers = new Set();
    let revenue = 0;
    let units = 0;
    let delivered = 0;
    let bom = 0;
    rows.forEach((row) => {
      const sku = skuById[row.sku_id] || {};
      revenue += toEur(row.turnover, row.currency);
      units += number(row.qty_ordered);
      delivered += Math.min(number(row.qty_ordered), number(row.delivered_qty));
      bom += number(row.qty_ordered) * number(sku.bom_cost_rmb) * FX.CNY;
      poNumbers.add(normalizePo(row.po_number));
    });
    let freight = 0;
    let freightPoCount = 0;
    poNumbers.forEach((po) => {
      if (freightByPo[po] == null) return;
      freight += freightByPo[po];
      freightPoCount += 1;
    });
    const cn = creditNotes(months, scope).reduce((total, row) => total + toEur(row.amount, row.currency), 0);
    const bp = planValue(months, scope);
    const bpQuantity = planQuantity(months, scope);
    const gp = revenue - bom - freight;
    const np = gp - cn;
    return {
      months: months.slice(),
      scope: scope || "ALL",
      rows,
      revenue,
      units,
      delivered,
      poCount: poNumbers.size,
      freight,
      freightPoCount,
      missingFreightPoCount: Math.max(0, poNumbers.size - freightPoCount),
      bom,
      cn,
      gp,
      np,
      bp,
      bpQuantity,
      bpAchievement: bp > 0 ? revenue / bp * 100 : null,
      bpQuantityAchievement: bpQuantity > 0 ? units / bpQuantity * 100 : null,
      gpRate: revenue > 0 ? gp / revenue * 100 : null,
      npRate: revenue > 0 ? np / revenue * 100 : null,
      fulfilment: units > 0 ? delivered / units * 100 : null
    };
  }

  function countryRows(months) {
    return activeCountries()
      .map((country) => ({ country, ...aggregate(months, country.code) }))
      .filter((row) => row.revenue || row.bp || row.units)
      .sort((a, b) => b.revenue - a.revenue);
  }

  function channelRows(months, scope) {
    const groups = {};
    poRows(months, scope).forEach((row) => {
      const country = countryById[row.country_id] || {};
      const ka = kaById[row.ka_id] || {};
      const key = `${country.code || "--"}|${ka.id || "none"}`;
      const item = groups[key] = groups[key] || {
        country: country.code || "--",
        channel: ka.name || "未匹配渠道",
        fd: ka.fd || (ka.ka_type === "distributor" ? ka.name : "Direct / 未配置FD"),
        revenue: 0,
        units: 0,
        delivered: 0,
        pos: new Set()
      };
      item.revenue += toEur(row.turnover, row.currency);
      item.units += number(row.qty_ordered);
      item.delivered += Math.min(number(row.qty_ordered), number(row.delivered_qty));
      item.pos.add(normalizePo(row.po_number));
    });
    return Object.values(groups)
      .map((item) => ({ ...item, poCount: item.pos.size, fulfilment: item.units ? item.delivered / item.units * 100 : null }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  function skuRows(months, scope) {
    const rows = poRows(months, scope);
    const groups = {};
    const poLines = {};
    rows.forEach((row) => {
      const po = normalizePo(row.po_number);
      (poLines[po] = poLines[po] || []).push(row);
      const sku = skuById[row.sku_id] || {};
      const model = stripColor(sku.code || String(row.sku_id));
      const item = groups[model] = groups[model] || {
        model,
        product: sku.name || model,
        category: sku.category || "Other",
        units: 0,
        revenue: 0,
        bom: 0,
        freight: 0,
        cn: 0,
        bp: 0,
        bpQuantity: 0
      };
      item.units += number(row.qty_ordered);
      item.revenue += toEur(row.turnover, row.currency);
      item.bom += number(row.qty_ordered) * number(sku.bom_cost_rmb) * FX.CNY;
    });
    Object.entries(poLines).forEach(([po, lines]) => {
      const freight = freightByPo[po];
      if (freight == null) return;
      const total = lines.reduce((sum, row) => sum + toEur(row.turnover, row.currency), 0) || 1;
      lines.forEach((row) => {
        const sku = skuById[row.sku_id] || {};
        const model = stripColor(sku.code || String(row.sku_id));
        if (groups[model]) groups[model].freight += freight * toEur(row.turnover, row.currency) / total;
      });
    });
    const cnRows = creditNotes(months, scope);
    let unmatchedCn = 0;
    cnRows.forEach((row) => {
      const model = stripColor(row.base_model);
      if (model && groups[model]) groups[model].cn += toEur(row.amount, row.currency);
      else unmatchedCn += toEur(row.amount, row.currency);
    });
    const totalRevenue = Object.values(groups).reduce((sum, row) => sum + row.revenue, 0) || 1;
    Object.values(groups).forEach((row) => { row.cn += unmatchedCn * row.revenue / totalRevenue; });

    const monthSet = new Set(months.map((value) => Number(value.slice(5, 7))));
    const years = new Set(months.map((value) => Number(value.slice(0, 4))));
    (DATA.business_plan_detail || []).forEach((row) => {
      if (!years.has(Number(row.year)) || !monthSet.has(Number(row.month))) return;
      if (scope && scope !== "ALL" && (countryById[row.country_id] || {}).code !== scope) return;
      const model = stripColor(row.model_code);
      const matchedSku = Object.values(skuById).find((sku) => stripColor(sku.code) === model) || {};
      const item = groups[model] = groups[model] || {
        model,
        product: matchedSku.name || row.product_name || model,
        category: matchedSku.category || row.category || "Other",
        units: 0,
        revenue: 0,
        bom: 0,
        freight: 0,
        cn: 0,
        bp: 0,
        bpQuantity: 0
      };
      item.bp += number(row.si_value);
      item.bpQuantity += number(row.si_qty);
    });

    return Object.values(groups).map((row) => {
      const gp = row.revenue - row.bom - row.freight;
      const np = gp - row.cn;
      return {
        ...row,
        gp,
        np,
        bpAchievement: row.bp > 0 ? row.revenue / row.bp * 100 : null,
        bpQuantityAchievement: row.bpQuantity > 0 ? row.units / row.bpQuantity * 100 : null,
        gpRate: row.revenue > 0 ? gp / row.revenue * 100 : null,
        npRate: row.revenue > 0 ? np / row.revenue * 100 : null
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  function categoryRows(months, scope) {
    const groups = {};
    skuRows(months, scope).forEach((row) => {
      const item = groups[row.category] = groups[row.category] || { category: row.category, revenue: 0, bp: 0, bpQuantity: 0, gp: 0, np: 0, units: 0 };
      item.revenue += row.revenue;
      item.bp += row.bp;
      item.bpQuantity += row.bpQuantity;
      item.gp += row.gp;
      item.np += row.np;
      item.units += row.units;
    });
    return Object.values(groups).map((row) => ({
      ...row,
      bpAchievement: row.bp > 0 ? row.revenue / row.bp * 100 : null,
      bpQuantityAchievement: row.bpQuantity > 0 ? row.units / row.bpQuantity * 100 : null,
      gpRate: row.revenue > 0 ? row.gp / row.revenue * 100 : null,
      npRate: row.revenue > 0 ? row.np / row.revenue * 100 : null
    })).sort((a, b) => b.revenue - a.revenue);
  }

  function freightDetails(months, scope) {
    const poGroups = {};
    poRows(months, scope).forEach((row) => {
      const poNumber = normalizePo(row.po_number);
      const country = countryById[row.country_id] || {};
      const item = poGroups[poNumber] = poGroups[poNumber] || {
        poNumber,
        country: country.code || "--",
        orderDate: row.po_date || "--",
        units: 0,
        delivered: 0,
        revenue: 0,
        lines: []
      };
      item.units += number(row.qty_ordered);
      item.delivered += Math.min(number(row.qty_ordered), number(row.delivered_qty));
      item.revenue += toEur(row.turnover, row.currency);
      item.lines.push(row);
    });

    const byPo = Object.values(poGroups).map((item) => {
      const source = freightRecordByPo[item.poNumber];
      const fee = source ? toEur(source.delivery_fee, source.currency) : null;
      return {
        ...item,
        fee,
        feeRate: fee != null && item.revenue ? fee / item.revenue * 100 : null,
        originalFee: source ? number(source.delivery_fee) : null,
        originalCurrency: source ? source.currency : null,
        note: source && source.notes || "",
        status: source ? "confirmed" : "missing"
      };
    }).sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)) || a.poNumber.localeCompare(b.poNumber));

    const skuGroups = {};
    byPo.forEach((po) => {
      const denominator = po.revenue || po.lines.reduce((sum, row) => sum + number(row.qty_ordered), 0) || 1;
      po.lines.forEach((row) => {
        const sku = skuById[row.sku_id] || {};
        const code = sku.code || String(row.sku_id);
        const item = skuGroups[code] = skuGroups[code] || {
          sku: code,
          product: sku.name || code,
          category: sku.category || "Other",
          countries: new Set(),
          poNumbers: new Set(),
          missingPoNumbers: new Set(),
          units: 0,
          delivered: 0,
          revenue: 0,
          fee: 0
        };
        const lineRevenue = toEur(row.turnover, row.currency);
        const allocationBase = po.revenue ? lineRevenue : number(row.qty_ordered);
        item.countries.add((countryById[row.country_id] || {}).code || "--");
        item.poNumbers.add(po.poNumber);
        if (po.fee == null) item.missingPoNumbers.add(po.poNumber);
        item.units += number(row.qty_ordered);
        item.delivered += Math.min(number(row.qty_ordered), number(row.delivered_qty));
        item.revenue += lineRevenue;
        if (po.fee != null) item.fee += po.fee * allocationBase / denominator;
      });
    });

    const bySku = Object.values(skuGroups).map((item) => ({
      ...item,
      countries: Array.from(item.countries).sort().join(" / "),
      poCount: item.poNumbers.size,
      missingPoCount: item.missingPoNumbers.size,
      feeRate: item.revenue ? item.fee / item.revenue * 100 : null
    })).sort((a, b) => b.fee - a.fee || b.revenue - a.revenue);

    return { byPo, bySku };
  }

  function creditNoteType(row) {
    const text = `${row.product || ""} ${row.customer || ""}`.toLowerCase();
    if (text.includes("price protection")) return "Price Protection";
    if (text.includes("margin protection")) return "Margin Protection";
    if (text.includes("rebate") || text.includes("bonus")) return "Rebate";
    if (text.includes("quality") || text.includes("defect")) return "Quality";
    if (text.includes("delivery") || text.includes("freight")) return "Delivery Fee";
    return "Other";
  }

  function creditNoteDetails(months, scope) {
    const rows = creditNotes(months, scope);
    const creditGroups = {};
    const skuGroups = {};

    rows.forEach((row) => {
      const country = countryById[row.country_id] || {};
      const amount = toEur(row.amount, row.currency);
      const type = creditNoteType(row);
      const numberKey = row.cn_no || `CN-${row.id}`;
      const credit = creditGroups[numberKey] = creditGroups[numberKey] || {
        creditNumber: numberKey,
        date: row.cn_date || "--",
        countries: new Set(),
        customers: new Set(),
        types: new Set(),
        skuCount: 0,
        amount: 0
      };
      credit.countries.add(country.code || "--");
      credit.customers.add(row.customer || "未配置客户");
      credit.types.add(type);
      credit.skuCount += 1;
      credit.amount += amount;

      const model = stripColor(row.base_model || "未匹配SKU");
      const matchedSku = Object.values(skuById).find((sku) => stripColor(sku.code) === model) || {};
      const sku = skuGroups[model] = skuGroups[model] || {
        sku: model,
        product: matchedSku.name || row.product || model,
        countries: new Set(),
        creditNumbers: new Set(),
        types: new Set(),
        amount: 0
      };
      sku.countries.add(country.code || "--");
      sku.creditNumbers.add(numberKey);
      sku.types.add(type);
      sku.amount += amount;
    });

    const byCredit = Object.values(creditGroups).map((item) => ({
      ...item,
      countries: Array.from(item.countries).sort().join(" / "),
      customers: Array.from(item.customers).join(" / "),
      types: Array.from(item.types).join(" / ")
    })).sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.creditNumber.localeCompare(b.creditNumber));

    const revenueByModel = Object.fromEntries(skuRows(months, scope).map((row) => [row.model, row.revenue]));
    const bySku = Object.values(skuGroups).map((item) => ({
      ...item,
      countries: Array.from(item.countries).sort().join(" / "),
      creditCount: item.creditNumbers.size,
      types: Array.from(item.types).join(" / "),
      revenue: revenueByModel[item.sku] || 0,
      feeRate: revenueByModel[item.sku] ? item.amount / revenueByModel[item.sku] * 100 : null
    })).sort((a, b) => b.amount - a.amount);

    return { byCredit, bySku };
  }

  function forecastForMonths(months, scope) {
    const runs = (DATA.forecast_run || []).filter((row) => row.status === "published");
    const runByMonth = {};
    months.forEach((month) => {
      const iso = `${month}-01`;
      runByMonth[month] = runs
        .filter((run) => run.period_start <= iso && run.period_end >= iso)
        .sort((a, b) => String(b.period_start).localeCompare(String(a.period_start)) || number(b.id) - number(a.id))[0];
    });
    const forecast = {};
    (DATA.forecast_cell || []).forEach((cell) => {
      const month = String(cell.month || "").slice(0, 7);
      const run = runByMonth[month];
      const ka = kaById[cell.ka_id] || {};
      const country = countryById[ka.country_id] || {};
      if (!run || cell.run_id !== run.id || !months.includes(month)) return;
      if (scope && scope !== "ALL" && country.code !== scope) return;
      const key = `${country.code || "--"}|${cell.sku_id}|${month}`;
      forecast[key] = (forecast[key] || 0) + number(cell.qty);
    });
    const actual = {};
    poRows(months, scope).forEach((row) => {
      const country = countryById[row.country_id] || {};
      const month = String(row.po_date || "").slice(0, 7);
      const key = `${country.code || "--"}|${row.sku_id}|${month}`;
      actual[key] = (actual[key] || 0) + number(row.qty_ordered);
    });
    const keys = new Set([...Object.keys(forecast), ...Object.keys(actual)]);
    let forecastTotal = 0;
    let actualTotal = 0;
    let absoluteError = 0;
    const exceptions = [];
    keys.forEach((key) => {
      const fc = forecast[key] || 0;
      const po = actual[key] || 0;
      forecastTotal += fc;
      actualTotal += po;
      absoluteError += Math.abs(po - fc);
      const [country, skuId, month] = key.split("|");
      const variance = fc > 0 ? (po - fc) / fc * 100 : (po > 0 ? 100 : 0);
      if (Math.abs(variance) >= 20 || (fc === 0 && po > 0)) exceptions.push({
        country,
        sku: skuById[Number(skuId)] || {},
        month,
        forecast: fc,
        po,
        variance
      });
    });
    const byMonth = months.map((month) => {
      let fc = 0;
      let po = 0;
      Object.entries(forecast).forEach(([key, value]) => { if (key.endsWith(`|${month}`)) fc += value; });
      Object.entries(actual).forEach(([key, value]) => { if (key.endsWith(`|${month}`)) po += value; });
      return { month, forecast: fc, po };
    });
    return {
      forecast: forecastTotal,
      po: actualTotal,
      gap: actualTotal - forecastTotal,
      accuracy: forecastTotal > 0 ? Math.max(0, 100 - absoluteError / forecastTotal * 100) : null,
      exceptions: exceptions.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
      byMonth,
      runByMonth
    };
  }

  function reviews(year, quarter, scope) {
    return (DATA.channel_quarterly_review || []).filter((row) => {
      if (Number(row.year) !== Number(year) || Number(row.quarter) !== Number(quarter)) return false;
      if (!scope || scope === "ALL") return true;
      return (countryById[row.country_id] || {}).code === scope;
    });
  }

  function confirmedResults(months, scope) {
    const normalizedScope = scope || "ALL";
    const cacheKey = `${normalizedScope}|${months.join(",")}`;
    if (confirmedCache.has(cacheKey)) return confirmedCache.get(cacheKey);
    const result = aggregate(months, normalizedScope);
    const forecast = forecastForMonths(months, normalizedScope);
    const countries = countryRows(months).filter((row) => normalizedScope === "ALL" || row.country.code === normalizedScope);
    const businessResult = {
      ...result,
      details: {
        countries,
        channels: channelRows(months, normalizedScope),
        categories: categoryRows(months, normalizedScope),
        skus: skuRows(months, normalizedScope)
      }
    };
    const runRows = Object.values(forecast.runByMonth || {}).filter(Boolean);
    const latestRun = runRows.sort((a, b) => String(b.published_at || b.updated_at || "").localeCompare(String(a.published_at || a.updated_at || "")))[0];
    const period = months.length ? `${months[0]}_${months[months.length - 1]}` : "empty";
    const contract = (module, source, status, statusLabel, version, confirmedAt, value) => ({
      module, source, status, statusLabel, version, confirmedAt, scope: normalizedScope, months: months.slice(), result: value
    });
    const confirmed = {
      business: contract("performance", "经营分析复盘", "confirmed", "已确认", `OPS-${period}-v3`, "2026-07-08 09:00", businessResult),
      bp: contract("bp", "BP达成", "confirmed", "已确认", `BP-${period}-v3`, "2026-07-07 18:00", {
        value: result.bp,
        quantity: result.bpQuantity,
        actualValue: result.revenue,
        actualQuantity: result.units,
        valueGap: result.revenue - result.bp,
        quantityGap: result.units - result.bpQuantity,
        achievement: result.bpAchievement,
        quantityAchievement: result.bpQuantityAchievement,
        details: {
          countries,
          categories: businessResult.details.categories,
          skus: businessResult.details.skus
        }
      }),
      forecast: contract("forecast", "预测评分卡", "published", "已发布", latestRun && latestRun.code || `FCST-${period}`, latestRun && (latestRun.published_at || latestRun.updated_at) || "2026-06-18 03:28", forecast),
      logistics: contract("shipmentSummary", "物流交付", "confirmed", "已确认", `LOG-${period}-v2`, "2026-07-08 08:30", {
        freight: result.freight,
        freightPoCount: result.freightPoCount,
        missingFreightPoCount: result.missingFreightPoCount,
        delivered: result.delivered,
        fulfilment: result.fulfilment,
        poCount: result.poCount,
        details: freightDetails(months, normalizedScope)
      }),
      settlement: contract("settlement", "结算台账", "closed", "已关账", `SET-${period}-v2`, "2026-07-08 08:45", {
        creditNote: result.cn,
        details: creditNoteDetails(months, normalizedScope)
      })
    };
    confirmedCache.set(cacheKey, confirmed);
    return confirmed;
  }

  window.BusinessMetrics = {
    FX,
    activeCountries,
    aggregate,
    categoryRows,
    channelRows,
    confirmedResults,
    countryRows,
    creditNoteDetails,
    forecastForMonths,
    freightDetails,
    monthsForHalf,
    monthsForPeriod,
    monthsForQuarter,
    monthsForYear,
    periodLabel,
    planQuantity,
    reviews,
    skuRows,
    stripColor,
    toEur
  };
})();
