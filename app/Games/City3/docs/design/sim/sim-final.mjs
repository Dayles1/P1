#!/usr/bin/env node
/**
 * City Chronicle 3 (Летопись города 3) — FINAL GDD simulation.
 *
 *   node sim-final.mjs              full report pasted into gdd.md §14 (≈1–3 min)
 *   node sim-final.mjs --roster     + every content table of gdd.md (§3, §7, §8, §10, §11) generated from this config
 *   node sim-final.mjs --quick      only the three reference profiles
 *
 * Model: the aggregate (non-spatial) economy of gdd.md §2–§9 with the constants of §15, plus ONE spatial pass (§14.8)
 * that lays out the real 40-row grid with Manhattan service diamonds to check the population gates against land capacity.
 * Units: 1 tick = 1 game second; every content rate is PER YEAR (1 year = 25 ticks) and is applied /25 per tick.
 * Deterministic for a given seed. Random events are not simulated (expected value ≈ +1 % of income, §13).
 * Note: "§…" numbers in the comments below refer to the earlier 16-section synthesis draft. In the final design document
 * (../gdd.md) the report of this script is §12 and the content tables are §8–§9; sim ids villa / workshop / forestry / tower
 * are the content ids manor / smithy / lumber / skyscraper (gdd Appendix B).
 */
import { pathToFileURL } from 'url';

// ───────────────────────────────────────────────────────────── utilities
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash01 = n => { let x = (n | 0) ^ 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const nice = x => { if (x <= 0) return 0; if (x < 10) return Math.round(x * 10) / 10; const p = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };
const nice2 = x => { if (x === 0) return 0; if (x < 0.1) return Math.round(x * 1000) / 1000; if (x < 1) return Math.round(x * 100) / 100; if (x < 10) return Math.round(x * 10) / 10; if (x < 1000) return Math.round(x); return nice(x); };
const fmt = n => { const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2) + 'M'; if (a >= 1e5) return (n / 1e3).toFixed(0) + 'K'; if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K'; if (a >= 1000) return (n / 1e3).toFixed(2) + 'K'; return (Math.round(n * 10) / 10).toString(); };
const area = r => 2 * r * r + 2 * r + 1;                        // tiles within Manhattan distance r of one tile
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const q = (arr, f) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * f))]; };
const SPY = 25;                                                  // seconds (ticks) per game year

// ───────────────────────────────────────────────────────────── constants (= gdd.md §15 world.json)
export const K = {
  secondsPerYear: SPY, startYear: 1,
  start: { money: 1200, food: 160, mat: 160, goods: 0, pop: 6 },
  tax: 1.0,                                   // money per citizen per year (era-0 home, happiness 50, normal policy)
  workforceShare: 0.5, unemploymentTaxLoss: 0.3,
  foodPerCitizen: 0.4,                        // food per citizen per year
  price: { foodImport: 1.0, foodExport: 0.4, matImport: 4.0, matExport: 1.5, goodsExport: 6.0, fuelImport: 3.0, fuelExport: 1.2, grid: 100 },
  exportAbove: 0.9, storageBase: 1200,
  growthRate: 0.03, growthFlat: 0.2, moveOut: 0.05, decline: 0.004,   // per tick (population converges in ≈1–2 years)
  occupancy: { from: 25, span: 45 },          // occ(h) = clamp((h − 25)/45, 0, 1): full homes at happiness ≥ 70
  happy: { base: 35, comfort: 30, auraCap: 15, starving: 25, noPower: 15, pollutionCap: 30 },
  taxPolicy: { low: [0.8, 8], normal: [1, 0], high: [1.2, -10] },
  tradeIn: 0.7, upgradeFloor: 0.25, refundShare: 0.5,
  comfortFill: [0.7, 0.3],                    // effective housing = housing × (0.7 + 0.3 × service share)
  organicPerYear: 0.015,                      // free climb of an eligible home, only to levels of era ≤ city era − 1
  tourism: { perPoint: 4.0, heritageMult: 2, heritageEraGap: 2, beachVillaMult: 1.5, heritageCharter: 0.5 },
  trips: { perCitizen: 0.5, perJob: 0.3, length: 10, hotspot: 1.3 },
  congestion: { happyPerUnit: 15, happyCap: 15, effSlope: 0.4 },
  golden: { perStar: 0.05, years: 10, ramp: 2, happy: 3 },
  spirit: { perYear: 0.001, cap: 0.3 },
  roadShareOfTiles: 0.4, coverageEfficiency: 0.45,
  upkeepPerYear: { civic: 0.008, housing: 0, food: 0.006, raw: 0.008, industry: 0.008, trade: 0.008, storage: 0.006,
                   service: 0.013, park: 0.013, culture: 0.008, energy: 0.008, power: 0.012, transport: 0.008 },
  upkeepEraMult: [0.35, 0.5, 0.65, 0.8, 0.9, 1.0, 1.0],      // x upkeepPerYear, by the level's own era
  matRatio: { civic: 0.06, housing: 0.08, raw: 0.04, default: 0.05 },
  labourOrder: ['svc', 'food', 'raw', 'ind', 'com'],
  chest: { maxYearsOfNet: 1, fillRealHours: 8, cooldownYears: 25 },
  loan: { maxYearsOfGross: 3, ratePerYear: 0.10, repayShareOfNet: 0.25 },
  arrears: { mothballPerYear: 1 },                // empty treasury with negative net: the costliest non-home building is mothballed each year
  density: { era: 3, housing: 0.15, happy: -6, trips: 0.10 },
  orders: { everyYears: 6, expireYears: 12, premium: 2.0, qtyShareOfPortTrade: 0.5, slots: [2, 3, 4] },
  routes: { slots: [2, 4], open: [400000, 1200000], upkeep: [12000, 30000], touristVisitors: 15000, cargoTrade: 2500, cargoPremium: 0.10, businessTax: 0.03 },
  programs: { costShareOfGross: 0.015, max: 3, autonomousTrips: 0.2, gridPower: 0.15, cityOsTax: 0.04, cleanAir: 0.3 },
  metro: { tunnelPerTile: 12000, tilesPerStation: 8, fareShareOfTax: 0.1, ridersPerStation: 4000 },
  rail: { tilesToPortal: 18, throughTiles: 30, throughMult: 1.5, throughVisitors: 1.2, freightPremium: 0.10 },
  airportNoise: { r: 4, happiness: -8 },
  charters: { craft: 0.15, marketTax: 0.08, marketTrade: 0.15, greenPollution: 0.5, greenHappy: 4 },
};
// Era scaling — the single source of "how much more things cost / pay in era e" (gdd §5.7)
export const SCALE = {
  JM: [1, 2, 4, 8, 15, 26, 40],                     // jobs multiplier by level era (flattens late: automation)
  taxMult: [1, 1.6, 2.5, 4, 6, 9, 13],              // tax per citizen by the ERA OF THE HOME'S LEVEL
  homePaybackYears: [7, 14, 34, 65, 100, 155, 190], // a home repays its price in taxes in T years
  prodPaybackYears: [10, 17, 34, 60, 90, 125, 150], // a producer repays its price (net of upkeep, at reference prices)
  ref: { food: 1.0, mat: 2.5, goods: 6, fuel: 2.5, trade: 3, matInCost: 2.5 },
};
SCALE.cpc = SCALE.homePaybackYears.map((p, e) => p * K.tax * SCALE.taxMult[e]);   // cost per citizen of a home
SCALE.M = SCALE.cpc.map(x => +(x / SCALE.cpc[0]).toFixed(1));                     // cost multiplier for non-homes

export const ERAS = [
  { id: 'e0', hist: 0, ru: 'Античность', en: 'Antiquity', money: ['Драхмы', 'Drachmae', '₯'] },
  { id: 'e1000', hist: 1000, ru: 'Средневековье', en: 'Middle Ages', money: ['Гроши', 'Groats', '₰'] },
  { id: 'e1500', hist: 1500, ru: 'Возрождение', en: 'Renaissance', money: ['Флорины', 'Florins', 'ƒ'] },
  { id: 'e1800', hist: 1800, ru: 'Индустриальная эра', en: 'Industrial Age', money: ['Банкноты', 'Banknotes', '₤'] },
  { id: 'e1900', hist: 1900, ru: 'Модерн', en: 'Modern Age', money: ['Наличные', 'Cash', '¤'] },
  { id: 'e2000', hist: 2000, ru: 'Современность', en: 'Contemporary', money: ['Карты', 'Card money', '▣'] },
  { id: 'e2100', hist: 2100, ru: 'Ближнее будущее', en: 'Near Future', money: ['Кредиты', 'Credits', '◈'] },
];
// Chronicle star thresholds (entry year ≤ value). ★ = ahead of history (year ≤ hist). Re-derived by this script (§14.3):
// silver = median typical entry year × 1.05, gold = best typical/optimised run × 1.02 (5 seeds each).
export let STARS = [null, { s2: 76, s3: 72 }, { s2: 157, s3: 143 }, { s2: 235, s3: 222 }, { s2: 366, s3: 341 }, { s2: 558, s3: 498 }, { s2: 750, s3: 700 }];

// ───────────────────────────────────────────────────────────── discoveries (28 = 4 per era, paid in money)
const R_COST = [240, 1200, 7200, 48000, 280000, 1400000, 6000000];
const R_TIME = [40, 70, 100, 130, 160, 190, 220];               // game seconds, ÷ research speed
const D = (id, era, i, ru, en, eff = {}, unlocks = []) => ({ id, era, ru, en, cost: nice(R_COST[era] * [0.8, 1, 1.2, 1.4][i]), time: Math.round(R_TIME[era] * [0.8, 1, 1.1, 1.3][i]), eff, unlocks });
export const DISC = [
  D('agriculture', 0, 0, 'Земледелие', 'Agriculture', { food: 0.25 }),
  D('masonry', 0, 1, 'Каменная кладка', 'Masonry', { mat: 0.2 }, ['house:2', 'well:2']),
  D('writing', 0, 2, 'Письменность', 'Writing', { research: 0.1 }, ['school:1']),
  D('coinage', 0, 3, 'Чеканка монет', 'Coinage', { tax: 0.1, trade: 0.2 }),
  D('three_field', 1, 0, 'Трёхполье', 'Three-field system', { food: 0.25 }, ['farm:2']),
  D('metallurgy', 1, 1, 'Металлургия', 'Metallurgy', {}, ['mine:1', 'workshop:1']),
  D('self_government', 1, 2, 'Самоуправление', 'Self-government', { tax: 0.05 }, ['district_hall:1']),
  D('brickmaking', 1, 3, 'Обжиг кирпича', 'Brickmaking', {}, ['kiln:1', 'house:4']),
  D('printing', 2, 0, 'Книгопечатание', 'Printing press', { research: 0.25 }, ['school:3']),
  D('navigation', 2, 1, 'Мореплавание', 'Navigation', { trade: 0.25 }, ['port:1']),
  D('banking', 2, 2, 'Банковское дело', 'Banking', { tax: 0.1 }),
  D('glassblowing', 2, 3, 'Стеклоделие', 'Glassblowing', {}, ['glassworks:1']),
  D('steam_engine', 3, 0, 'Паровая машина', 'Steam engine', { prod: 0.1 }, ['coal_mine:1']),
  D('steelmaking', 3, 1, 'Сталеварение', 'Steelmaking', {}, ['steel_mill:1', 'road:a1']),
  D('railways', 3, 2, 'Железные дороги', 'Railways', {}, ['rail_station:1']),
  D('public_education', 3, 3, 'Всеобщее образование', 'Public education', { research: 0.15, happy: 3 }, ['school:4']),
  D('electricity', 4, 0, 'Электричество', 'Electricity', {}, ['power_plant:1', 'windmill:2']),
  D('reinforced_concrete', 4, 1, 'Железобетон', 'Reinforced concrete', {}, ['cement_plant:1', 'house:8', 'block:2']),
  D('subway', 4, 2, 'Метрополитен', 'Underground railway', {}, ['metro_station:1']),
  D('combustion', 4, 3, 'Двигатель внутреннего сгорания', 'Combustion engine', { prod: 0.05 }, ['oil_well:1', 'farm:4']),
  D('computers', 5, 0, 'Компьютеры', 'Computers', { research: 0.25 }, ['school:6']),
  D('highrise', 5, 1, 'Высотное строительство', 'High-rise engineering', { housing: 0.05 }, ['tower:1', 'house:10', 'block:4']),
  D('semiconductors', 5, 2, 'Полупроводники', 'Semiconductors', {}, ['electronics_fab:1', 'chemical_plant:1']),
  D('aviation', 5, 3, 'Авиация', 'Aviation', {}, ['airport:1']),
  D('robotics', 6, 0, 'Робототехника', 'Robotics', { prod: 0.2 }, ['composites_plant:1']),
  D('solar_power', 6, 1, 'Солнечная энергетика', 'Solar power', {}, ['solar_farm:1', 'windmill:3']),
  D('smart_city', 6, 2, 'Умный город', 'Smart city', { happy: 5, congestion: 0.15 }, ['data_center:1', 'road:s7', 'road:a4']),
  D('hydroponics', 6, 3, 'Гидропоника', 'Hydroponics', {}, ['vertical_farm:1', 'farm:6', 'fishery:4']),
];
const DISC_BY_ID = Object.fromEntries(DISC.map(d => [d.id, d]));
const UNLOCKED_BY = {};
for (const d of DISC) for (const u of d.unlocks) UNLOCKED_BY[u] = d.id;

// ───────────────────────────────────────────────────────────── needs ladder (gdd §6.1): tier T requires NEEDS[0..T-1]
export const NEEDS = ['water', 'leisure', 'health', 'education', 'happy50', 'aura', 'power', 'transit', 'happy65', 'data'];
export const NEED_RU = { water: 'Вода', leisure: 'Досуг', health: 'Здоровье', education: 'Образование', happy50: 'Довольство ≥ 50', aura: 'Парк или рынок рядом',
  power: 'Электричество', transit: 'Транспорт (метро или автобус)', happy65: 'Довольство ≥ 65', data: 'Дата-центр (r10)' };

// ───────────────────────────────────────────────────────────── buildings
// Level: era ru reuse { … }  — derived below: money, matCost, jobs, outputs, upkeep (all per year)
const lv = (era, ru, reuse, e = {}) => ({ era, ru, reuse, ...e });
const HERITAGE = new Set(['temple', 'theater', 'villa', 'market', 'school', 'park', 'architect_bureau']);
const LANDMARK_RU = 'храм, театр, усадьба, рынок, школа, парк, бюро архитекторов';
export const B = {
  town_center: { ru: 'Ратуша', en: 'Town Hall', cat: 'civic', size: [2, 2], place: 'land', unique: true, levels: [
    lv(0, 'Шатёр вождя', 'town_center L1', { money: 0, housing: 8, trade: 6, storage: 1200, aura: [4, 6], time: 0, visitors: 10 }),
    lv(0, 'Дом вождя', 'town_center L2', { money: 400, housing: 12, trade: 10, storage: 2000, aura: [5, 7], time: 1 * SPY, visitors: 20 }),
    lv(1, 'Ратуша', 'town_center L3', { money: 2400, housing: 18, trade: 25, storage: 4800, aura: [5, 8], time: 3 * SPY, visitors: 60 }),
    lv(2, 'Дворец', 'town_center L4', { money: 22000, housing: 25, trade: 80, storage: 12000, aura: [6, 10], time: 5 * SPY, attraction: 2, visitors: 200 }),
    lv(3, 'Городская управа', 'town_center L5', { money: 150000, housing: 35, trade: 250, storage: 32000, aura: [6, 10], time: 7 * SPY, attraction: 3, visitors: 600 }),
    lv(4, 'Мэрия', 'town_center L6', { money: 800000, housing: 50, trade: 600, storage: 80000, aura: [7, 12], time: 9 * SPY, attraction: 4, pu: 5, visitors: 2000 }),
    lv(5, 'Сити-холл', 'town_center L7', { money: 3500000, housing: 70, trade: 1400, storage: 200000, aura: [7, 12], time: 11 * SPY, attraction: 6, pu: 10, visitors: 6000 }),
    lv(6, 'Цифровая мэрия', 'town_center L8', { money: 18000000, housing: 100, trade: 3000, storage: 480000, aura: [8, 14], time: 13 * SPY, attraction: 8, pu: 15, visitors: 15000 }),
  ]},
  house: { ru: 'Жилой дом', en: 'House', cat: 'housing', size: [1, 1], place: 'land', cpcMult: 1, tiers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], levels: [
    lv(0, 'Шалаш', 'house L1', { housing: 4, time: 5 }),
    lv(0, 'Глинобитный дом', 'house L2', { housing: 6, time: 7, f: 1.15 }),
    lv(1, 'Изба', 'house L3', { housing: 10, time: 9 }),
    lv(1, 'Каменный дом', 'house L4', { housing: 14, time: 12, f: 1.15 }),
    lv(2, 'Фахверковый дом', 'house L5', { housing: 20, time: 15 }),
    lv(3, 'Кирпичный дом', 'house L6', { housing: 30, time: 20 }),
    lv(3, 'Доходный дом', 'house L7', { housing: 42, time: 25, f: 1.15 }),
    lv(4, 'Многоэтажка', 'house L8', { housing: 70, time: 30, pu: 1.5 }),
    lv(5, 'Высотка', 'house L9', { housing: 110, time: 40, pu: 2.5 }),
    lv(5, 'Небоскрёб', 'house L10', { housing: 160, time: 50, pu: 3.5, f: 1.15 }),
    lv(6, 'Эко-башня', 'house L11', { housing: 230, time: 55, pu: 4, aura: [1, 3] }),
  ]},
  block: { ru: 'Жилой квартал', en: 'Apartment block', cat: 'housing', size: [2, 2], place: 'land', cpcMult: 0.85, tiers: [5, 7, 8, 9, 10], levels: [
    lv(3, 'Рабочие бараки', 'block L1', { housing: 110, time: 20, aura: [1, -3] }),
    lv(4, 'Доходный квартал', 'block L2', { housing: 230, time: 30, pu: 3 }),
    lv(5, 'Панельный дом', 'block L3', { housing: 380, time: 35, pu: 6, aura: [1, -2] }),
    lv(5, 'Жилой комплекс', 'block L4', { housing: 540, time: 45, pu: 9, aura: [2, 3], f: 1.15 }),
    lv(6, 'Модульный квартал', 'block L5', { housing: 760, time: 50, pu: 12 }),
  ]},
  tower: { ru: 'Башня', en: 'Tower', cat: 'housing', size: [2, 2], place: 'land', cpcMult: 1.05, tiers: [9, 10], levels: [
    lv(5, 'Башня арт-деко', 'skyscraper L1', { housing: 900, jobs: 150, time: 60, pu: 16, aura: [2, 2] }),
    lv(6, 'Стеклянная башня', 'skyscraper L2', { housing: 1300, jobs: 220, time: 70, pu: 22, aura: [2, 3] }),
  ]},
  villa: { ru: 'Усадьба', en: 'Villa', cat: 'housing', size: [2, 2], place: 'landOrBeach', villa: 3, cpcMult: 3.5, tiers: [2, 4, 5, 7, 9, 10], levels: [
    lv(1, 'Усадьба', 'manor L1', { housing: 10, attraction: 0.5, aura: [3, 6], time: 15 }),
    lv(2, 'Палаццо', 'manor L2', { housing: 16, attraction: 1, aura: [4, 8], time: 20 }),
    lv(3, 'Особняк', 'manor L3', { housing: 24, attraction: 1, aura: [4, 10], time: 25 }),
    lv(4, 'Вилла модерн', 'manor L4', { housing: 32, attraction: 1.5, aura: [5, 12], time: 30, pu: 2 }),
    lv(5, 'Пентхаус-комплекс', 'manor L5', { housing: 48, attraction: 1.5, aura: [5, 14], time: 40, pu: 4 }),
    lv(6, 'Эко-поместье', 'manor L6', { housing: 64, attraction: 2, aura: [6, 16], time: 45, pu: 5 }),
  ]},
  // ── food
  farm: { ru: 'Ферма', en: 'Farm', cat: 'food', cls: 'food', size: [2, 2], place: 'land', base: 240, jobs: 4, out: 'food', k: 1.0, levels: [
    lv(0, 'Поле', 'farm L1', { time: 6 }), lv(1, 'Ферма с амбаром', 'farm L2', { time: 10 }),
    lv(2, 'Мельничная ферма', 'farm L3', { time: 14 }), lv(4, 'Механизированная ферма', 'farm L4', { pu: 2, time: 25 }),
    lv(5, 'Агрохолдинг', 'farm L5', { pu: 4, time: 35 }), lv(6, 'Гидропоника', 'farm L6', { pu: 8, time: 40 }),
  ]},
  fishery: { ru: 'Рыбный промысел', en: 'Fishery', cat: 'food', cls: 'food', size: [1, 1], place: 'coast', base: 120, jobs: 2, out: 'food', k: 1.15, levels: [
    lv(0, 'Хижина рыбака', 'fishery L1', { time: 5 }), lv(1, 'Причал', 'fishery L2', { time: 8 }),
    lv(3, 'Рыбный порт', 'fishery L3', { pollution: [1, 2], time: 20 }), lv(6, 'Акваферма', 'fishery L4', { pu: 4, time: 40 }),
  ]},
  vertical_farm: { ru: 'Вертикальная ферма', en: 'Vertical farm', cat: 'food', cls: 'food', size: [2, 2], place: 'land', base: 480, jobs: 4, out: 'food', k: 1.1, levels: [
    lv(6, 'Вертикальная ферма', 'vertical_farm L1', { pu: 15, time: 50 }),
  ]},
  // ── materials (extraction = raw class; processing = industry class)
  forestry: { ru: 'Лесхоз', en: 'Tree plantation', cat: 'raw', cls: 'raw', size: [1, 1], place: 'land', base: 100, jobs: 3, out: 'mat', k: 0.75, levels: [
    lv(0, 'Делянка', 'lumber L1', { time: 5 }), lv(1, 'Лесопилка', 'lumber L2', { time: 8 }),
    lv(3, 'Паровая лесопилка', 'lumber L3', { pollution: [2, 3], time: 18 }), lv(4, 'Деревокомбинат', 'lumber L4', { pu: 3, pollution: [2, 4], time: 25 }),
    lv(6, 'Лесная ферма', 'lumber L5', { pu: 5, aura: [2, 2], time: 40 }),
  ]},
  quarry: { ru: 'Каменоломня', en: 'Quarry', cat: 'raw', cls: 'raw', size: [2, 2], place: 'mountain', base: 200, jobs: 4, out: 'mat', k: 1.2, levels: [
    lv(0, 'Каменоломня', 'quarry L1', { time: 8 }), lv(1, 'Карьер', 'quarry L2', { time: 12 }),
    lv(3, 'Динамитный карьер', 'quarry L3', { pollution: [3, 6], time: 20 }), lv(4, 'Экскаваторный карьер', 'quarry L4', { pu: 3, pollution: [3, 8], time: 30 }),
    lv(6, 'Роботизированный карьер', 'quarry L5', { pu: 8, pollution: [2, 4], time: 45 }),
  ]},
  mine: { ru: 'Рудник', en: 'Mine', cat: 'raw', cls: 'raw', size: [2, 2], place: 'mountain', deposit: 'ore', base: 360, jobs: 6, out: 'mat', k: 1.15, levels: [
    lv(1, 'Железный рудник', 'mine L1', { time: 12 }), lv(2, 'Шахта', 'mine L2', { time: 15 }),
    lv(3, 'Паровая шахта', 'mine L3', { pollution: [3, 6], time: 20 }), lv(4, 'Глубокая шахта', 'mine L4', { pu: 4, pollution: [3, 7], time: 30 }),
    lv(6, 'Автошахта', 'mine L5', { pu: 10, pollution: [2, 4], time: 45 }),
  ]},
  coal_mine: { ru: 'Угольная шахта', en: 'Coal mine', cat: 'raw', cls: 'raw', size: [2, 2], place: 'mountain', deposit: 'coal', base: 480, jobs: 6, out: 'fuel', k: 1.0, levels: [
    lv(3, 'Угольная шахта', 'coal_mine L1', { pollution: [3, 8], time: 20 }), lv(4, 'Механизированная шахта', 'coal_mine L2', { pu: 3, pollution: [3, 10], time: 30 }),
    lv(5, 'Угольный разрез', 'coal_mine L3', { pu: 5, pollution: [4, 12], time: 40 }),
  ]},
  oil_well: { ru: 'Нефтяная вышка', en: 'Oil well', cat: 'raw', cls: 'raw', size: [1, 1], place: 'coast', deposit: 'oil', base: 400, jobs: 5, out: 'fuel', k: 1.1, levels: [
    lv(4, 'Нефтяная вышка', 'oil_well L1', { pollution: [2, 6], time: 25 }), lv(5, 'Насосная станция', 'oil_well L2', { pu: 3, pollution: [2, 6], time: 35 }),
    lv(6, 'Глубоководная платформа', 'oil_well L3', { pu: 5, pollution: [2, 5], time: 45 }),
  ]},
  kiln: { ru: 'Кирпичный завод', en: 'Brickworks', cat: 'industry', cls: 'ind', size: [1, 1], place: 'land', base: 240, jobs: 4, out: 'mat', k: 0.95, levels: [
    lv(1, 'Печь обжига', 'kiln L1', { pollution: [1, 3], time: 10 }), lv(3, 'Кирпичный завод', 'kiln L2', { pollution: [2, 6], time: 18 }),
    lv(4, 'Керамический комбинат', 'kiln L3', { pu: 5, pollution: [2, 5], time: 28 }),
  ]},
  steel_mill: { ru: 'Сталелитейный завод', en: 'Steel mill', cat: 'industry', cls: 'ind', size: [2, 2], place: 'land', base: 1000, jobs: 8, out: 'mat', k: 1.3, input: 'fuel', inShare: 0.2, levels: [
    lv(3, 'Литейная', 'steel_mill L1', { pollution: [3, 10], time: 20 }), lv(4, 'Мартеновский завод', 'steel_mill L2', { pu: 4, pollution: [3, 12], time: 30 }),
    lv(5, 'Электросталь', 'steel_mill L3', { pu: 20, pollution: [3, 8], time: 40, inShare: 0.05 }), lv(6, 'Фабрика сплавов', 'steel_mill L4', { pu: 30, pollution: [2, 4], time: 50, inShare: 0.05 }),
  ]},
  cement_plant: { ru: 'Цементный завод', en: 'Cement plant', cat: 'industry', cls: 'ind', size: [2, 2], place: 'land', base: 1200, jobs: 8, out: 'mat', k: 1.3, input: 'fuel', inShare: 0.2, levels: [
    lv(4, 'Цементный завод', 'cement_plant L1', { pollution: [3, 10], time: 28 }), lv(5, 'Бетонный комбинат', 'cement_plant L2', { pu: 8, pollution: [3, 10], time: 38 }),
    lv(6, 'Геополимерный завод', 'cement_plant L3', { pu: 14, pollution: [2, 4], time: 45, inShare: 0.05 }),
  ]},
  composites_plant: { ru: 'Завод композитов', en: 'Composites plant', cat: 'industry', cls: 'ind', size: [2, 2], place: 'land', base: 2400, jobs: 8, out: 'mat', k: 1.35, input: 'fuel', inShare: 0.15, levels: [
    lv(6, 'Композитный завод', 'composites_plant L1', { pu: 15, pollution: [1, 3], time: 50 }),
  ]},
  workshop: { ru: 'Мастерская', en: 'Workshop', cat: 'industry', cls: 'ind', size: [1, 1], place: 'land', base: 320, jobs: 5, out: 'goods', k: 1.8, levels: [
    lv(1, 'Кузница', 'smithy L1', { pollution: [1, 2], time: 10 }), lv(2, 'Мастерская', 'smithy L2', { pollution: [1, 3], time: 14 }),
    lv(3, 'Инструментальный завод', 'smithy L3', { pollution: [2, 6], time: 20 }), lv(4, 'Машзавод', 'smithy L4', { pu: 6, pollution: [2, 6], time: 30 }),
    lv(6, 'Робофабрика', 'smithy L5', { pu: 12, pollution: [1, 2], time: 45 }),
  ]},
  glassworks: { ru: 'Стекольный завод', en: 'Glassworks', cat: 'industry', cls: 'ind', size: [2, 2], place: 'landOrBeach', base: 880, jobs: 10, out: 'goods', k: 1.9, levels: [
    lv(2, 'Стеклодувня', 'glassworks L1', { pollution: [1, 3], time: 14 }), lv(3, 'Стекольный завод', 'glassworks L2', { pollution: [2, 5], time: 20 }),
    lv(4, 'Флоат-завод', 'glassworks L3', { pu: 6, pollution: [2, 5], time: 30 }), lv(6, 'Завод умного стекла', 'glassworks L4', { pu: 14, time: 45 }),
  ]},
  chemical_plant: { ru: 'Химический завод', en: 'Chemical plant', cat: 'industry', cls: 'ind', size: [2, 2], place: 'land', base: 2400, jobs: 10, out: 'goods', k: 1.9, input: 'fuel', inShare: 0.3, levels: [
    lv(5, 'Нефтехимзавод', 'chemical_plant L1', { pu: 10, pollution: [3, 12], time: 40 }),
    lv(6, 'Биопластиковый завод', 'chemical_plant L2', { pu: 14, pollution: [1, 2], time: 45, input: 'food', inShare: 0.25 }),
  ]},
  electronics_fab: { ru: 'Завод электроники', en: 'Electronics plant', cat: 'industry', cls: 'ind', size: [2, 2], place: 'land', base: 3600, jobs: 12, out: 'goods', k: 2.1, levels: [
    lv(5, 'Завод электроники', 'electronics_fab L1', { pu: 15, time: 45 }), lv(6, 'Чиповая фабрика', 'electronics_fab L2', { pu: 30, time: 50 }),
  ]},
  // ── trade & storage
  market: { ru: 'Рынок', en: 'Market', cat: 'trade', cls: 'com', size: [2, 2], place: 'land', base: 320, jobs: 4, out: 'trade', k: 0.8, levels: [
    lv(0, 'Агора', 'market L1', { aura: [3, 4], time: 10 }), lv(1, 'Ярмарка', 'market L2', { aura: [4, 5], attraction: 0.5, time: 14 }),
    lv(2, 'Торговый дом', 'market L3', { aura: [4, 6], attraction: 1, time: 18 }), lv(3, 'Биржа', 'market L4', { aura: [4, 6], attraction: 1, time: 25 }),
    lv(4, 'Универмаг', 'market L5', { pu: 4, aura: [5, 8], attraction: 2, time: 30 }), lv(5, 'Торговый центр', 'market L6', { pu: 10, aura: [5, 10], attraction: 3, time: 40 }),
    lv(6, 'Голо-молл', 'market L7', { pu: 18, aura: [6, 12], attraction: 4, time: 50 }),
  ]},
  storehouse: { ru: 'Склад', en: 'Storehouse', cat: 'storage', cls: 'svc', size: [1, 1], place: 'landOrBeach', base: 160, jobs: 1, levels: [
    lv(0, 'Амбар', 'storehouse L1', { storage: 1600, time: 6 }), lv(1, 'Склад', 'storehouse L2', { storage: 4800, time: 9 }),
    lv(2, 'Пакгауз', 'storehouse L3', { storage: 12000, time: 12 }), lv(3, 'Товарный склад', 'storehouse L4', { storage: 32000, time: 18 }),
    lv(5, 'Логистический центр', 'storehouse L5', { storage: 120000, pu: 3, time: 30 }), lv(6, 'Автосклад', 'storehouse L6', { storage: 280000, pu: 6, time: 40 }),
  ]},
  // ── services (coverage)
  well: { ru: 'Колодец', en: 'Well', cat: 'service', cls: 'svc', service: 'water', size: [1, 1], place: 'land', base: 120, jobs: 1, levels: [
    lv(0, 'Колодец', 'well L1', { r: 3, time: 5, jobs: 0 }), lv(0, 'Акведук', 'well L2', { r: 4, time: 10, f: 3 }),
    lv(3, 'Водокачка', 'well L3', { r: 6, time: 15 }), lv(4, 'Водопровод', 'well L4', { r: 8, pu: 2, time: 20 }),
    lv(5, 'Водоочистная станция', 'well L5', { r: 10, pu: 6, time: 30 }),
  ]},
  clinic: { ru: 'Лечебница', en: 'Clinic', cat: 'service', cls: 'svc', service: 'health', size: [1, 1], place: 'land', base: 160, jobs: 2, levels: [
    lv(1, 'Знахарь', 'clinic L1', { r: 3, time: 8 }), lv(2, 'Лазарет', 'clinic L2', { r: 4, time: 14 }),
    lv(3, 'Больница', 'clinic L3', { r: 6, time: 20 }), lv(4, 'Поликлиника', 'clinic L4', { r: 7, pu: 3, time: 26 }),
    lv(5, 'Медцентр', 'clinic L5', { r: 9, pu: 8, time: 36 }),
  ]},
  school: { ru: 'Школа', en: 'School', cat: 'service', cls: 'svc', service: 'education', size: [2, 2], place: 'land', base: 480, jobs: 3, levels: [
    lv(0, 'Школа философов', 'school L1', { r: 4, research: 0.15, time: 12 }), lv(1, 'Монастырская школа', 'school L2', { r: 5, research: 0.2, time: 16 }),
    lv(2, 'Университет', 'school L3', { r: 6, research: 0.3, attraction: 1, time: 22 }), lv(3, 'Академия наук', 'school L4', { r: 7, research: 0.4, attraction: 1, time: 28 }),
    lv(4, 'НИИ', 'school L5', { r: 8, research: 0.55, pu: 5, time: 32 }), lv(5, 'Технопарк', 'school L6', { r: 9, research: 0.7, pu: 12, time: 42 }),
    lv(6, 'Лаборатория будущего', 'school L7', { r: 10, research: 0.9, pu: 18, time: 50 }),
  ]},
  temple: { ru: 'Храм', en: 'Temple', cat: 'service', cls: 'svc', service: 'leisure', size: [2, 2], place: 'land', base: 360, jobs: 2, levels: [
    lv(0, 'Святилище', 'temple L1', { r: 4, attraction: 1, time: 10 }), lv(1, 'Церковь', 'temple L2', { r: 5, attraction: 2, time: 16 }),
    lv(2, 'Собор', 'temple L3', { r: 7, attraction: 5, time: 30, f: 1.5 }),
  ]},
  theater: { ru: 'Театр', en: 'Theatre', cat: 'service', cls: 'svc', service: 'leisure', size: [2, 2], place: 'landOrBeach', base: 600, jobs: 3, levels: [
    lv(0, 'Амфитеатр', 'theater L1', { r: 4, attraction: 1, time: 14, tc: 2 }), lv(2, 'Театр', 'theater L2', { r: 5, attraction: 2, time: 18 }),
    lv(3, 'Опера', 'theater L3', { r: 6, attraction: 4, time: 25 }), lv(4, 'Кинотеатр', 'theater L4', { r: 6, attraction: 4, pu: 4, time: 28 }),
    lv(5, 'Мультиплекс', 'theater L5', { r: 7, attraction: 6, pu: 10, time: 38 }), lv(6, 'Голотеатр', 'theater L6', { r: 8, attraction: 8, pu: 16, time: 45 }),
  ]},
  park: { ru: 'Парк', en: 'Park', cat: 'park', cls: 'svc', size: [1, 1], place: 'landOrBeach', base: 48, jobs: 0, levels: [
    lv(0, 'Роща', 'park L1', { aura: [2, 4], time: 4 }), lv(2, 'Сад', 'park L2', { aura: [3, 6], time: 8 }),
    lv(3, 'Парк', 'park L3', { aura: [3, 8], attraction: 0.3, time: 10 }), lv(4, 'Сквер с фонтаном', 'park L4', { aura: [4, 10], pu: 1, attraction: 0.5, time: 14 }),
    lv(6, 'Эко-парк', 'park L5', { aura: [5, 12], pu: 2, attraction: 1, time: 25 }),
  ]},
  district_hall: { ru: 'Управа района', en: 'District office', cat: 'culture', cls: 'svc', size: [1, 1], place: 'land', base: 300, jobs: 2, levels: [
    lv(1, 'Сельская управа', 'district_hall L1', { r: 6, time: 10 }), lv(2, 'Управа', 'district_hall L2', { r: 7, time: 14 }),
    lv(4, 'Префектура', 'district_hall L3', { r: 7, pu: 2, time: 20 }), lv(5, 'Мэрия округа', 'district_hall L4', { r: 8, pu: 5, time: 28 }),
    lv(6, 'Цифровой хаб', 'district_hall L5', { r: 8, pu: 8, time: 35 }),
  ]},
  architect_bureau: { ru: 'Бюро архитекторов', en: 'Architects’ bureau', cat: 'culture', cls: 'svc', size: [2, 2], place: 'land', unique: true, base: 800, jobs: 2, levels: [
    lv(2, 'Мастерская зодчего', 'architect_bureau L1', { attraction: 1, time: 20 }),
    lv(4, 'Архитектурное бюро', 'architect_bureau L2', { attraction: 2, pu: 2, time: 30 }),
    lv(6, '3D-студия', 'architect_bureau L3', { attraction: 3, pu: 8, time: 45 }),
  ]},
  data_center: { ru: 'Дата-центр', en: 'Data centre', cat: 'culture', cls: 'svc', size: [2, 2], place: 'land', base: 3000, jobs: 6, levels: [
    lv(6, 'Дата-центр', 'data_center L1', { r: 10, research: 0.3, dataTax: 0.05, pu: 30, time: 45 }),
  ]},
  // ── energy
  windmill: { ru: 'Ветряк', en: 'Windmill', cat: 'energy', cls: 'svc', size: [1, 1], place: 'landOrBeach', base: 240, jobs: 1, levels: [
    lv(2, 'Ветряная мельница', 'windmill L1', { farmBoost: 0.25, time: 12 }), lv(4, 'Ветрогенератор', 'windmill L2', { power: 12, time: 20 }),
    lv(6, 'Ветропарк', 'windmill L3', { power: 40, time: 30 }),
  ]},
  power_plant: { ru: 'Электростанция', en: 'Power plant', cat: 'power', cls: 'svc', size: [2, 2], place: 'land', base: 2400, jobs: 6, levels: [
    lv(4, 'Угольная электростанция', 'power_plant L1', { power: 80, fuelUse: 200, pollution: [4, 15], time: 35 }),
    lv(5, 'ТЭЦ', 'power_plant L2', { power: 200, fuelUse: 300, pollution: [4, 12], time: 45 }),
    lv(6, 'Газотурбинная', 'power_plant L3', { power: 400, fuelUse: 400, pollution: [3, 8], time: 50 }),
  ]},
  solar_farm: { ru: 'Солнечная ферма', en: 'Solar farm', cat: 'energy', cls: 'svc', size: [2, 2], place: 'landOrBeach', base: 1800, jobs: 1, levels: [
    lv(6, 'Солнечная ферма', 'solar_farm L1', { power: 150, time: 40 }),
  ]},
  // ── transport (NEW models)
  port: { ru: 'Порт', en: 'Port', cat: 'transport', cls: 'svc', size: [3, 2], place: 'coast', unique: true, base: 600, jobs: 6, out: 'trade', k: 1.15, levels: [
    lv(2, 'Гавань', 'NEW', { visitors: 600, importDisc: 0.10, time: 25, pollution: [1, 1] }),
    lv(3, 'Паровой порт', 'NEW', { visitors: 2500, importDisc: 0.15, pollution: [2, 4], time: 35 }),
    lv(5, 'Контейнерный терминал', 'NEW', { visitors: 8000, importDisc: 0.20, pu: 10, pollution: [2, 4], time: 50 }),
  ]},
  rail_station: { ru: 'Вокзал', en: 'Railway station', cat: 'transport', cls: 'svc', size: [4, 2], place: 'land', rotatable: true, base: 2800, jobs: 10, out: 'trade', k: 1.0, levels: [
    lv(3, 'Вокзал', 'NEW', { visitors: 2500, time: 40 }),
    lv(4, 'Центральный вокзал', 'NEW', { visitors: 8000, pu: 6, time: 50 }),
    lv(6, 'Маглев-терминал', 'NEW', { visitors: 25000, pu: 20, time: 70, f: 1.2 }),
  ]},
  metro_station: { ru: 'Станция метро', en: 'Metro station', cat: 'transport', cls: 'svc', size: [1, 1], place: 'road', base: 1800, jobs: 2, levels: [
    lv(4, 'Станция метро', 'NEW', { r: 5, transit: 0.35, appeal: 6, pu: 3, time: 30 }),
    lv(5, 'Станция-пересадка', 'NEW', { r: 6, transit: 0.4, appeal: 7, pu: 5, time: 35 }),
    lv(6, 'Смарт-хаб', 'NEW', { r: 7, transit: 0.45, appeal: 8, pu: 8, time: 40 }),
  ]},
  airport: { ru: 'Аэропорт', en: 'Airport', cat: 'transport', cls: 'svc', size: [12, 4], place: 'airportPlot', unique: true, base: 10000, jobs: 20, out: 'trade', k: 0.5, levels: [
    lv(5, 'Аэропорт', 'NEW', { visitors: 40000, goodsPremium: 0.15, pu: 20, time: 90 }),
    lv(6, 'Аэрохаб', 'NEW', { visitors: 100000, goodsPremium: 0.25, pu: 35, time: 120, f: 1.15 }),
  ]},
};
const JOB_CLASS = { civic: 'svc', service: 'svc', park: 'svc', culture: 'svc', energy: 'svc', power: 'svc', transport: 'svc', storage: 'svc', food: 'food', raw: 'raw', industry: 'ind', trade: 'com', housing: 'com' };
// derive money / materials / jobs / outputs / upkeep (per year)
for (const [id, b] of Object.entries(B)) {
  b.id = id;
  b.cls = b.cls ?? JOB_CLASS[b.cat];
  b.levels.forEach((l, i) => {
    l.level = i + 1;
    const f = l.f ?? 1;
    if (l.money === undefined) l.money = b.cat === 'housing' ? nice(l.housing * SCALE.cpc[l.era] * b.cpcMult * f) : nice(b.base * SCALE.M[l.era] * f);
    l.matCost = nice(l.money * (K.matRatio[b.cat] ?? K.matRatio.default));
    if (l.jobs === undefined) l.jobs = Math.round((b.jobs ?? 0) * SCALE.JM[l.era] * (b.cat === 'housing' ? 0 : 1));
    l.upkeep = b.id === 'town_center' ? 0 : nice2(l.money * (K.upkeepPerYear[b.cat] ?? 0.006) * K.upkeepEraMult[l.era]);
    if (b.tiers) l.tier = b.tiers[i];
    if (b.out) {
      const net = (l.money + l.matCost * SCALE.ref.matInCost) / SCALE.prodPaybackYears[l.era] * b.k;   // net value per year
      const inShare = l.inShare ?? b.inShare ?? 0, input = l.input ?? b.input;
      const gross = (net + l.upkeep) / (1 - inShare);
      if (input) { l.input = input; l.inputUse = nice2(gross * inShare / SCALE.ref[input]); }
      l[b.out] = nice2(gross / SCALE.ref[b.out]);
    }
    l.time = l.time ?? 10;
  });
}

// Roads: one tile each (16 m). Street family = pleasant; Avenue family = capacity. cap = trips per tile.
export const ROADS = {
  street: [
    { id: 's1', era: 0, ru: 'Тропа', en: 'Dirt path', money: 8, cap: 45, upkeep: 0, appeal: 0 },
    { id: 's2', era: 1, ru: 'Мостовая', en: 'Cobbled lane', money: 24, cap: 65, upkeep: 0.07, appeal: 1 },
    { id: 's3', era: 2, ru: 'Мощёная улица', en: 'Paved street', money: 100, cap: 85, upkeep: 0.17, appeal: 2 },
    { id: 's4', era: 3, ru: 'Улица с газовыми фонарями', en: 'Gas-lit street', money: 320, cap: 110, upkeep: 0.4, appeal: 2 },
    { id: 's5', era: 4, ru: 'Асфальтовая улица', en: 'Asphalt street', money: 1000, cap: 150, upkeep: 1.0, appeal: 2 },
    { id: 's6', era: 5, ru: 'Зелёная улица', en: 'Tree-lined street', money: 2800, cap: 180, upkeep: 2.3, appeal: 4 },
    { id: 's7', era: 6, ru: 'Смарт-улица', en: 'Smart street', money: 7200, cap: 220, upkeep: 5.3, appeal: 5, retrofit: 's6', tech: 'smart_city' },
  ],
  avenue: [
    { id: 'a1', era: 3, ru: 'Тракт с конкой', en: 'Macadam avenue with horse tram', money: 1000, cap: 260, upkeep: 1, appeal: -2, transit: 0.03, tech: 'steelmaking' },
    { id: 'a2', era: 4, ru: 'Проспект', en: 'Avenue', money: 2800, cap: 450, upkeep: 3, appeal: -3, transit: 0.05 },
    { id: 'a3', era: 5, ru: 'Бульвар с трамваем', en: 'Tram boulevard', money: 8000, cap: 420, upkeep: 6.7, appeal: 0, transit: 0.15 },
    { id: 'a4', era: 6, ru: 'Смарт-проспект', en: 'Smart avenue', money: 20000, cap: 560, upkeep: 15, appeal: 1, transit: 0.18, retrofit: 'a3', tech: 'smart_city' },
  ],
};
for (const k of ['street', 'avenue']) for (const r of ROADS[k]) r.matCost = nice(r.money * 0.25);
export const TRACK = [
  { era: 3, ru: 'Паровая железная дорога', en: 'Steam railway', money: 6000 },
  { era: 4, ru: 'Электрифицированная дорога', en: 'Electrified railway', money: 16000 },
  { era: 5, ru: 'Скоростная магистраль', en: 'High-speed line', money: 40000 },
  { era: 6, ru: 'Маглев', en: 'Maglev', money: 100000 },
];

// Expansion strips: 14 × 5 columns (7 per side). Price only by how many are owned; either side; no era gate.
export const STRIPS = {
  width: 5, count: 14,
  price: [2000, 4400, 9600, 21000, 48000, 105000, 230000, 500000, 1200000, 2800000, 6400000, 16000000, 40000000, 100000000],
  // deposits (the same for every player). rich = ×1.5 output for buildings on that deposit
  left: [ { ore: 2, rich: 'ore' }, { coal: 2 }, { portal: 1 }, { oil: 4 }, { coal: 2, rich: 'coal' }, { ore: 2 }, { cape: 1 } ],
  right: [ { bay: 1 }, { ore: 2 }, { portal: 1, coal: 2 }, { ore: 2, rich: 'ore' }, { oil: 4, rich: 'oil' }, { sunny: 1 }, { cape: 1 } ],
  start: { ore: 2, coal: 2, portal: 1 },
};
export const START_COLS = [35, 64];

// Era gates = Town Hall upgrade checklists (index = era being entered). TH level = era + 2. ≤ 4 lines each.
export const GATES = [null,
  { pop: 80, items: [{ ru: 'Агора', type: 'market', level: 1, n: 1 }, { ru: 'Школа философов', type: 'school', level: 1, n: 1 }],
    density: '—' },
  { pop: 460, items: [{ ru: 'Управа района с грамотой', type: 'district_hall', level: 1, n: 1 }, { ru: '2 кузницы', type: 'workshop', level: 1, n: 2 }],
    density: 'house L4 (Обжиг кирпича)' },
  { pop: 1800, items: [{ ru: 'Гавань и 4 торговых заказа', type: 'port', level: 1, n: 1, extra: c => c.ordersDelivered >= 4 }, { ru: 'Стеклодувня', type: 'glassworks', level: 1, n: 1 }],
    density: 'house L5 + villas' },
  { pop: 7000, items: [{ ru: 'Вокзал на линии к порталу', type: 'rail_station', level: 1, n: 1 }, { ru: 'Литейная', type: 'steel_mill', level: 1, n: 1 }],
    density: 'blocks L1, house L7, policy «Плотная застройка» (+15 %)' },
  { pop: 20000, items: [{ ru: 'Линия метро (2 станции)', type: 'metro_station', level: 1, n: 2 }, { ru: 'Электростанция', type: 'power_plant', level: 1, n: 1 }],
    density: 'house L8 + block L2 (Железобетон), avenues' },
  { pop: 45000, items: [{ ru: 'Аэропорт и 2 авиарейса', type: 'airport', level: 1, n: 1, extra: c => c.routes.length >= 2 }, { ru: 'Завод электроники', type: 'electronics_fab', level: 1, n: 1 }],
    density: 'house L9–L10, block L3–L4, towers (Высотное строительство +5 %)' },
];
export const TC2_POP = 30;
export const GATE_DISC = 3;

const G = (era, ru, test, reward) => ({ era, ru, test, reward });
export const GOALS = [
  G(0, 'Первые очаги: 3 дома', c => c.count('house') >= 3, 160), G(0, 'Хлеб насущный: поле', c => c.count('farm') >= 1, 160),
  G(0, 'Камень с гор: каменоломня', c => c.count('quarry') >= 1, 160), G(0, 'Деревня: 20 жителей', c => c.pop >= 20, 240),
  G(0, 'Агора', c => c.count('market') >= 1, 240), G(0, 'Первые письмена', c => c.disc.has('writing'), 240),
  G(0, 'Дом вождя', c => c.tcLevel >= 2, 400), G(0, 'Вода в каждый дом', c => c.s.cov.water >= 0.9 && c.s.homeTiles >= 10, 320),
  G(1, 'Средние века', c => c.era >= 1, 1200), G(1, 'Кузница', c => c.count('workshop') >= 1, 800), G(1, 'Город: 200 жителей', c => c.pop >= 200, 1200),
  G(1, 'Лекарь', c => c.count('clinic') >= 1, 600), G(1, 'Первая грамота', c => c.count('district_hall') >= 1, 800),
  G(2, 'Возрождение', c => c.era >= 2, 6000), G(2, 'Гавань', c => c.count('port') >= 1, 6000), G(2, 'Университет', c => c.countAt('school', 3) >= 1, 4800),
  G(2, '1000 жителей', c => c.pop >= 1000, 6000),
  G(3, 'Индустриальная эра', c => c.era >= 3, 28000), G(3, 'Сила пара: 6 заводов', c => c.count('workshop') + c.count('glassworks') + c.count('steel_mill') >= 6, 20000),
  G(3, 'Первый вокзал', c => c.count('rail_station') >= 1, 32000), G(3, '4000 жителей', c => c.pop >= 4000, 28000),
  G(4, 'Модерн', c => c.era >= 4, 120000), G(4, 'Да будет свет', c => c.s.power > 0, 100000), G(4, 'Первая линия метро', c => c.count('metro_station') >= 2, 120000),
  G(4, '12 000 жителей', c => c.pop >= 12000, 120000),
  G(5, 'Современность', c => c.era >= 5, 480000), G(5, 'Аэропорт', c => c.count('airport') >= 1, 600000), G(5, '30 000 жителей', c => c.pop >= 30000, 480000),
  G(6, 'Ближнее будущее', c => c.era >= 6, 1600000),
];
// Achievements (+250 score each, 16 in total, gdd §11.3)
export const ACHIEVEMENTS = [
  ['ahead', 'Опередить историю', '★★★ in any era', c => c.entries.some(e => e.stars === 3)],
  ['golden', 'Золотая летопись', 'all 18 stars', c => c.entries.slice(1).reduce((a, e) => a + e.stars, 0) >= 18],
  ['scribe', 'Летописец', 'all 28 discoveries', c => c.disc.size >= 28],
  ['heritage', 'Наследие', '10 Heritage buildings', c => c.s.heritageCount >= 10],
  ['harbour', 'Гавань мира', 'Container terminal in the deep bay', c => c.buildings.some(b => b.type === 'port' && b.active >= 3 && b.bay)],
  ['steel', 'Стальной путь', 'a through-line between two portals', c => c.through],
  ['metro', 'Подземка', '4 metro lines (8 stations)', c => c.count('metro_station') >= 8],
  ['sky', 'Окно в мир', 'Aerohub', c => c.countAt('airport', 2) >= 1],
  ['coast', 'Весь берег', 'all 14 strips', c => c.stripsOwned >= 14],
  ['mega', 'Мегаполис', '100 000 citizens', c => c.peakPop >= 100000],
  ['flow', 'Без пробок', 'ρ < 0.8 with 50 000 citizens', c => c.flags.flow],
  ['clean', 'Чистое небо', 'pollution < 2 with 50 000 citizens', c => c.flags.clean],
  ['self', 'Самодостаточный', 'no imports for 20 years in the Near Future', c => c.flags.self],
  ['garden', 'Город-сад', 'happiness ≥ 90 for 10 years', c => c.flags.garden],
  ['ages', 'Век за веком', 'play across 1 000 calendar years', c => yearOf(c.t) >= 1000],
  ['nodebt', 'Без недоимок', 'never in arrears', c => c.arrearsTicks === 0],
];

// ───────────────────────────────────────────────────────────── helpers
const yearOf = t => K.startYear + t / SPY;
const lvl = (type, level) => B[type].levels[level - 1];
const SERVICES = ['water', 'health', 'education', 'leisure'];
const SERVICE_ERA = { water: 0, health: 1, education: 0, leisure: 0 };
const HOMES = ['house', 'block', 'tower', 'villa'];

// ───────────────────────────────────────────────────────────── the city
class City {
  constructor(profile, opts = {}) {
    this.p = profile; this.o = opts; this.rng = mulberry32(opts.seed ?? 1); this.uid = 0;
    this.t = 0;
    Object.assign(this, { money: K.start.money, food: K.start.food, mat: K.start.mat, goods: K.start.goods, pop: K.start.pop });
    this.era = 0; this.tcLevel = 1;
    this.disc = new Set(); this.research = null; this.lastResearchEnd = 0;
    this.buildings = []; this.pending = [];
    this.strips = { left: 0, right: 0 };
    this.street = 0; this.avenueLevel = -1; this.avenueShare = 0;
    this.railTiles = 0; this.railLevel = -1; this.through = false; this.metroTunnel = 0;
    this.policy = 'normal'; this.dense = false;
    this.orders = []; this.ordersDelivered = 0; this.orderSeq = 0; this.nextOrderT = 0;
    this.routes = []; this.programs = new Set();
    this.loan = 0; this.loansTaken = 0; this.interestPaid = 0;
    this.arrears = 0; this.arrearsTicks = 0;
    this.goalsDone = new Set(); this.flags = {}; this.flagT = {};
    this.goldenStart = -1e9; this.goldenStars = 0;
    this.entries = [{ era: 0, t: 0, year: 1, lead: null, stars: 0 }];
    this.spent = { build: 0, upgrade: 0, research: 0, strips: 0, roads: 0, transport: 0, imports: 0, tc: 0, routes: 0, programs: 0, energy: 0, fuel: 0, interest: 0 };
    this.earned = { tax: 0, trade: 0, tourism: 0, orders: 0, fares: 0, goals: 0, upkeep: 0, chest: 0, refunds: 0 };
    this.ema = { upk: 0, matImport: 0, foodImport: 0, fuelImport: 0, gridImport: 0, exportUse: 0, waste: 0, income: 0, net: 0, tax: 0, trade: 0, tour: 0, upkeep: 0, orders: 0, fares: 0, tourX: 0, tourC: 0 };
    this.actions = 0; this.homeActions = 0; this.organicUps = 0;
    this.h = 50; this.h50 = 50; this.bestH50 = 0; this.peakPop = this.pop;
    this.staff = { svc: 1, food: 1, raw: 1, ind: 1, com: 1 }; this.unemp = 0; this.rho = 0; this.powerRatio = 1;
    this.add('town_center', 1, { instant: true });
    this.recompute();
  }
  count(type) { let n = 0; for (const b of this.buildings) if (b.type === type) n++; return n; }
  countAt(type, minLevel) { let n = 0; for (const b of this.buildings) if (b.type === type && b.active >= minLevel) n++; return n; }
  get width() { return 30 + STRIPS.width * (this.strips.left + this.strips.right); }
  get stripsOwned() { return this.strips.left + this.strips.right; }
  // deposit slots owned: array of output multipliers (1 or 1.5)
  slots(kind) {
    const out = []; for (let i = 0; i < (STRIPS.start[kind] || 0); i++) out.push(1);
    for (const side of ['left', 'right']) for (let k = 0; k < this.strips[side]; k++) {
      const d = STRIPS[side][k]; for (let i = 0; i < (d[kind] || 0); i++) out.push(d.rich === kind ? 1.5 : 1);
    }
    return out.sort((a, b) => b - a);
  }
  feature(kind) { return this.slots(kind).length; }
  levelUnlocked(type, level) {
    const l = lvl(type, level);
    if (l.era > this.era) return false;
    if (l.tc && this.tcLevel < l.tc) return false;
    const d = UNLOCKED_BY[`${type}:${level}`]; if (d && !this.disc.has(d)) return false;
    const d1 = UNLOCKED_BY[`${type}:1`]; if (d1 && !this.disc.has(d1)) return false;
    return true;
  }
  bestLevel(type) { let best = 0; B[type].levels.forEach((l, i) => { if (this.levelUnlocked(type, i + 1)) best = i + 1; }); return best; }
  landUse() {
    let land = 0, beach = 0, mountain = 0, coast = 0;
    for (const b of this.buildings) {
      const d = B[b.type], tiles = d.size[0] * d.size[1];
      if (d.place === 'airportPlot' || d.place === 'road') continue;
      if (b.beach) beach += tiles;
      else if (d.place === 'coast') { coast += d.size[0]; beach += tiles; }
      else { land += tiles; if (d.place === 'mountain') mountain++; }
    }
    return { land, beach, mountain, coast, roads: Math.round(land * K.roadShareOfTiles + beach * 0.15), landRoads: Math.round(land * K.roadShareOfTiles) };
  }
  freeLand(u = this.landUse()) { return this.width * 40 * this.p.landEfficiency - u.land - u.landRoads; }
  canPlace(type, opts = {}) {
    const d = B[type], u = this.landUse(), w = this.width;
    if (d.unique && this.count(type) > 0) return false;
    if (d.deposit) { const used = this.buildings.filter(b => b.type === type).length; if (used >= this.feature(d.deposit)) return false; }
    const tiles = d.size[0] * d.size[1];
    if (d.place === 'airportPlot') return true;                    // the reserved 12×4 plot (gdd §7.2)
    if (d.place === 'road') return this.count(type) < u.roads / 12;  // a kiosk on a road tile; at most one per 12 road tiles
    if (d.place === 'mountain') return u.mountain < Math.floor(w / 2) && this.freeLand(u) >= tiles * (1 + K.roadShareOfTiles);
    if (d.place === 'coast') return u.coast + d.size[0] <= w;
    if (opts.beach) return u.beach + tiles + (this.count('airport') ? 0 : 48) <= w * 19 * 0.7;
    return this.freeLand(u) >= tiles * (1 + K.roadShareOfTiles);
  }
  // Construction price. Upgrades use the TRADE-IN rule (gdd §5.4): price = max(25 %, 1 − 0.7 × credit / target) × target,
  // credit = min(money actually paid for this building, list price of its current level). A chain never beats a direct build.
  costOf(type, level, b = null) {
    const l = lvl(type, level);
    let f = 1;
    if (b && type !== 'town_center') {
      const cur = lvl(type, b.active || b.level);
      f = Math.max(K.upgradeFloor, 1 - K.tradeIn * Math.min(b.paid, cur.money) / Math.max(1, l.money));
    }
    let money = l.money * f, mat = l.matCost * f;
    if (type === 'town_center') { const s = this.spirit(); money *= 1 - s; mat *= 1 - s; }
    if (!b && !['coast', 'airportPlot', 'road'].includes(B[type].place)) {
      const tiles = B[type].size[0] * B[type].size[1], r = ROADS.street[this.street];
      money += tiles * K.roadShareOfTiles * r.money; mat += tiles * K.roadShareOfTiles * r.matCost;
    }
    return { money, mat };
  }
  matImportPrice() { return K.price.matImport * (1 - this.s.importDisc); }
  totalPrice(c) { return c.money + Math.max(0, c.mat - this.mat) * this.matImportPrice(); }
  pay(c, bucket, b) {
    const missing = Math.max(0, c.mat - this.mat), imp = missing * this.matImportPrice(), total = c.money + imp;
    if (total > this.money + 1e-9) return false;
    this.money -= total; this.mat = Math.max(0, this.mat - c.mat);
    this.spent[bucket] += c.money; this.spent.imports += imp; this.ema.matImport += missing;
    if (b) b.paid += total;
    this.actions++;
    return total;
  }
  add(type, level, opts = {}) {
    const l = lvl(type, level);
    const b = { uid: ++this.uid, type, level, active: 0, readyAt: this.t + (opts.instant ? 0 : l.time), beach: !!opts.beach, paid: 0, builtEra: this.era, mult: 1, organic: hash01(this.uid * 7919) };
    if (!opts.instant && !this.pay(this.costOf(type, level), 'build', b)) return false;
    const d = B[type];
    if (d.deposit) { const used = this.buildings.filter(x => x.type === type).map(x => x.mult); const free = this.slots(d.deposit); for (const m of used) free.splice(free.indexOf(m), 1); b.mult = free[0] ?? 1; }
    if (type === 'port') b.bay = this.feature('bay') > 0;
    if (type === 'fishery') b.mult = this.feature('bay') > 0 && this.count('fishery') < 5 ? 1.25 : 1;
    if (type === 'district_hall') b.charter = opts.charter ?? 'craft';
    this.buildings.push(b);
    if (HOMES.includes(type)) this.homeActions++;
    if (opts.instant) { b.active = level; this.dirty = true; } else this.pending.push(b);
    return true;
  }
  upgrade(b, level) {
    const paid = this.pay(this.costOf(b.type, level, b), b.type === 'town_center' ? 'tc' : 'upgrade', b);
    if (!paid) return false;
    if (HOMES.includes(b.type)) this.homeActions++;
    b.level = level; b.readyAt = this.t + lvl(b.type, level).time;
    if (!this.pending.includes(b)) this.pending.push(b);
    return true;
  }
  demolish(b) {                                                  // refund = 50 % of money actually paid (never list price)
    const refund = K.refundShare * b.paid;
    this.money += refund; this.earned.refunds += refund;
    this.buildings.splice(this.buildings.indexOf(b), 1); const i = this.pending.indexOf(b); if (i >= 0) this.pending.splice(i, 1);
    this.dirty = true; this.actions++;
    return refund;
  }
  spirit() {
    const next = ERAS[this.era + 1]; if (!next) return 0;
    return Math.min(K.spirit.cap, Math.max(0, (yearOf(this.t) - next.hist) * K.spirit.perYear));
  }
  discCost(d) { return d.cost * (1 - this.spirit()); }
  startResearch(d) {
    const cost = this.discCost(d); if (this.money < cost) return false;
    this.money -= cost; this.spent.research += cost; this.actions++;
    this.research = { id: d.id, end: this.t + d.time / this.s.researchSpeed };
    return true;
  }
  stripPrice() { return STRIPS.price[this.stripsOwned]; }
  buyStrip(side) {
    const k = this.stripsOwned; if (k >= STRIPS.count || this.strips[side] >= 7) return false;
    if (this.money < STRIPS.price[k]) return false;
    this.money -= STRIPS.price[k]; this.spent.strips += STRIPS.price[k]; this.strips[side]++; this.dirty = true; this.actions++;
    return true;
  }
  golden() {
    const y = (this.t - this.goldenStart) / SPY, Y = K.golden.years, r = K.golden.ramp;
    if (y < 0 || y > Y) return 0;
    return this.goldenStars * K.golden.perStar * Math.max(0, Math.min(1, y / r, (Y - y) / r));
  }
  bonuses() {
    const bo = { food: 0, mat: 0, goods: 0, tax: 0, trade: 0, research: 0, prod: 0, housing: 0, happy: 0, congestion: 0 };
    for (const id of this.disc) for (const [k, v] of Object.entries(DISC_BY_ID[id].eff)) bo[k] += v;
    return bo;
  }
  recompute() {
    const bo = this.bonuses(), eff = K.coverageEfficiency;
    const s = { H: 0, taxW: 0, homeTiles: 0, tierTiles: new Array(12).fill(0), jobs: { svc: 0, food: 0, raw: 0, ind: 0, com: 0 },
      out: { food: { food: 0 }, raw: { mat: 0, fuel: 0 }, ind: { mat: 0, goods: 0 } }, fuelUseInd: 0, foodUseInd: 0, fuelUsePower: 0,
      trade: 0, storage: K.storageBase, power: 0, pu: 0, tourX: 0, visitors: 0, research: 0, upkeep: 0, cov: {}, transitHomes: 0, appeal: 0,
      farmBoostN: 0, goodsPremium: 0, importDisc: 0, stations: [], areas: { craft: 0, market: 0, green: 0, heritage: 0 }, dataArea: 0, dataTax: 0,
      prodTiles: 0, heritageCount: 0, metroHomes: 0, noiseHomes: 0 };
    const covSum = Object.fromEntries(SERVICES.map(x => [x, 0]));
    let poll = 0, auraSum = 0, attrRaw = [];
    for (const b of this.buildings) {
      if (!b.active || b.mothballed) continue;
      const d = B[b.type], l = lvl(b.type, b.active), tiles = d.size[0] * d.size[1];
      s.upkeep += l.upkeep;
      if (l.housing) {
        const h = l.housing * (1 + bo.housing);
        if (d.cat === 'housing') { s.homeTiles += tiles; s.tierTiles[l.tier] += tiles; }
        s.H += h; s.taxW += h * SCALE.taxMult[l.era] * (d.villa ?? 1);
      }
      s.jobs[d.cls] += l.jobs || 0;
      if (b.type === 'tower') s.jobs.com += 0;           // tower jobs are counted through l.jobs (com class)
      if (d.out === 'food') s.out.food.food += l.food * b.mult;
      if (d.out === 'mat') { if (d.cls === 'raw') s.out.raw.mat += l.mat * b.mult; else s.out.ind.mat += l.mat; s.prodTiles += tiles; }
      if (d.out === 'goods') { s.out.ind.goods += l.goods; s.prodTiles += tiles; }
      if (d.out === 'fuel') { s.out.raw.fuel += l.fuel * b.mult; s.prodTiles += tiles; }
      if (l.input === 'fuel') s.fuelUseInd += l.inputUse; if (l.input === 'food') s.foodUseInd += l.inputUse;
      if (d.out === 'trade' && b.type !== 'rail_station') s.trade += l.trade * (b.bay ? 1.5 : 1);
      if (b.type === 'rail_station') s.stations.push(l);
      if (b.type === 'town_center') s.trade += l.trade;
      if (l.storage) s.storage += l.storage;
      if (l.power) s.power += l.power;
      if (l.fuelUse) s.fuelUsePower += l.fuelUse;
      if (l.pu) s.pu += l.pu;
      if (l.visitors && b.type !== 'rail_station') s.visitors += l.visitors * (b.bay && b.type === 'port' ? 1.2 : 1);
      if (l.attraction) {
        let x = l.attraction * K.tourism.perPoint * SCALE.M[l.era];
        if (HERITAGE.has(b.type) && b.builtEra <= this.era - K.tourism.heritageEraGap) { x *= K.tourism.heritageMult; s.heritageCount++; }
        if (d.villa && b.beach) x *= K.tourism.beachVillaMult;
        attrRaw.push(x);
      }
      if (l.goodsPremium) s.goodsPremium = Math.max(s.goodsPremium, l.goodsPremium);
      if (l.importDisc) s.importDisc = Math.max(s.importDisc, l.importDisc);
      if (l.research) s.research += l.research;
      if (d.service) covSum[d.service] += area(l.r) * eff;
      if (b.type === 'district_hall') s.areas[b.charter] += area(l.r) * eff;
      if (b.type === 'data_center') { s.dataArea += area(l.r) * eff; s.dataTax = l.dataTax; }
      if (l.aura && b.type !== 'town_center') auraSum += area(l.aura[0]) * eff * l.aura[1];
      if (l.pollution) poll += area(l.pollution[0]) * l.pollution[1];
      if (l.transit) { s.transitHomes += area(l.r) * eff * l.transit; s.appeal += area(l.r) * eff * l.appeal; s.metroHomes += area(l.r) * eff; }
      if (l.farmBoost) s.farmBoostN++;
    }
    // stations: the best 3 count; a through-line between two portals gives ×1.5 trade and ×1.2 visitors
    s.stations.sort((a, b) => b.trade - a.trade);
    for (const l of s.stations.slice(0, 3)) { s.trade += l.trade * (this.through ? K.rail.throughMult : 1); s.visitors += l.visitors * (this.through ? K.rail.throughVisitors : 1); }
    for (const r of this.routes) { if (r === 'tourist') s.visitors += K.routes.touristVisitors; if (r === 'cargo') s.trade += K.routes.cargoTrade; }
    const ht = Math.max(1, s.homeTiles), landUsed = Math.max(1, this.landUse().land);
    for (const sv of SERVICES) s.cov[sv] = SERVICE_ERA[sv] <= this.era ? Math.min(1, covSum[sv] / ht) : null;
    const act = SERVICES.filter(x => s.cov[x] !== null);
    s.comfortShare = act.reduce((a, x) => a + s.cov[x], 0) / act.length;
    s.aura = Math.min(K.happy.auraCap, auraSum / ht);
    const share = a => Math.min(1, a / landUsed);
    s.craft = share(s.areas.craft); s.marketCh = share(s.areas.market); s.green = share(s.areas.green); s.heritageCh = share(s.areas.heritage);
    s.pollution = Math.min(K.happy.pollutionCap, this.p.exposure * poll * eff / ht * (1 - K.charters.greenPollution * s.green) * (this.programs.has('cleanair') ? 1 - K.programs.cleanAir : 1));
    const tcL = lvl('town_center', this.tcLevel);
    s.tcAura = tcL.aura[1] * Math.min(1, area(tcL.aura[0]) * eff / ht);
    s.Heff = s.H * (K.comfortFill[0] + K.comfortFill[1] * s.comfortShare) * (this.dense ? 1 + K.density.housing : 1);
    s.taxMult = s.H > 0 ? s.taxW / s.H : 1;
    s.researchSpeed = 1 + Math.min(1.5, s.research + bo.research);
    s.tourX = attrRaw.reduce((a, x) => a + x, 0) * (1 + K.tourism.heritageCharter * s.heritageCh);
    const av = this.avenueLevel >= 0 ? ROADS.avenue[this.avenueLevel] : null, st = ROADS.street[this.street];
    s.busCov = av ? Math.min(1, this.avenueShare * 2) : 0;
    s.metroCov = Math.min(1, s.metroHomes / ht);
    s.transitCov = Math.min(1, s.metroCov + s.busCov);
    s.transitShare = Math.min(0.6, s.transitHomes / ht + this.avenueShare * (av?.transit || 0));
    s.metroAppeal = Math.min(8, s.appeal / ht);
    s.dataCov = Math.min(1, s.dataArea / ht);
    const u = this.landUse();
    s.roadTiles = Math.max(8, u.roads);
    s.roadCap = (1 - this.avenueShare) * st.cap + (av ? this.avenueShare * av.cap : 0);
    s.roadAppeal = (1 - this.avenueShare) * st.appeal + (av ? this.avenueShare * av.appeal * 0.5 : 0);
    s.upkeep += s.roadTiles * ((1 - this.avenueShare) * st.upkeep + (av ? this.avenueShare * av.upkeep : 0));
    s.upkeep += this.railTiles * (this.railLevel >= 0 ? TRACK[this.railLevel].money * 0.01 : 0);
    s.upkeep += this.metroTunnel * K.metro.tunnelPerTile * 0.005;
    s.farmBoost = Math.min(0.25, s.farmBoostN * 0.25 * 4 / Math.max(1, this.count('farm')));
    s.power *= this.programs.has('grid') ? 1 + K.programs.gridPower : 1;
    s.landUsed = landUsed;
    this.s = s; this.dirty = false;
  }
  // share of homes allowed at need tier T (aggregate form of "every need of the level is covered at its tile")
  tierShare(T) {
    const s = this.s; let sh = 1;
    for (let i = 0; i < T; i++) {
      const n = NEEDS[i]; let v;
      if (n === 'water' || n === 'leisure' || n === 'education') v = s.cov[n] ?? 0;
      else if (n === 'health') v = s.cov.health ?? 0;
      else if (n === 'happy50') v = clamp((this.h - 40) / 20, 0, 1);
      else if (n === 'happy65') v = clamp((this.h - 55) / 20, 0, 1);
      else if (n === 'aura') v = clamp(s.aura / 6, 0, 1);
      else if (n === 'power') v = this.powerRatio >= 0.95 ? 1 : this.powerRatio;
      else if (n === 'transit') v = s.transitCov;
      else if (n === 'data') v = s.dataCov;
      sh = Math.min(sh, v);
    }
    return sh;
  }
  tierAllows(type, level, b = null) {
    const T = lvl(type, level).tier; if (!T) return true;
    const tiles = B[type].size[0] * B[type].size[1];
    let atLeast = 0; for (let i = T; i < 12; i++) atLeast += this.s.tierTiles[i];
    if (b && lvl(type, b.active || 1).tier >= T) atLeast -= tiles;
    return atLeast + tiles <= this.tierShare(T) * (this.s.homeTiles + (b ? 0 : tiles)) * 1.02 + 0.5;
  }
  organicGrowth() {                                            // once per game year
    const maxEra = this.era - 1; if (maxEra < 0) return;
    for (const b of this.buildings) {
      if (!HOMES.includes(b.type) || !b.active || b.level !== b.active || b.active >= B[b.type].levels.length) continue;
      const next = b.active + 1, nl = lvl(b.type, next);
      if (nl.era > maxEra || !this.levelUnlocked(b.type, next)) continue;
      if (!this.tierAllows(b.type, next, b)) continue;
      b.organic += K.organicPerYear;
      if (b.organic >= 1) { b.organic -= 1; b.level = b.active = next; b.builtEra = this.era; this.organicUps++; this.dirty = true; this.recompute(); }
    }
  }
  treasuryCheck() {                                            // empty treasury -> mothballing (gdd 5.9): never a dead end
    if (this.inArrears && this.ema.net < 0) {
      const cand = this.buildings.filter(b => b.active && !b.mothballed && !HOMES.includes(b.type) && b.type !== 'town_center' && lvl(b.type, b.active).upkeep > 0)
        .sort((a, b) => lvl(b.type, b.active).upkeep - lvl(a.type, a.active).upkeep)[0];
      if (cand) { cand.mothballed = true; this.mothballs = (this.mothballs || 0) + 1; this.dirty = true; }
    }
    this.inArrears = false;
  }
  newOrders() {
    const port = this.buildings.find(b => b.type === 'port' && b.active);
    if (!port) return;
    const slots = K.orders.slots[port.active - 1];
    this.orders = this.orders.filter(o => o.expires > this.t);
    if (this.t < this.nextOrderT || this.orders.length >= slots) return;
    const hseq = hash01(this.orderSeq * 104729 + 17);           // deterministic: the same order sequence for every player
    const goods = ['goods', 'mat', 'food'].filter(g => g === 'food' || (g === 'mat' ? this.s.out.raw.mat + this.s.out.ind.mat > 0 : this.s.out.ind.goods > 0));
    const good = goods[Math.floor(hseq * goods.length)];
    const portTrade = lvl('port', port.active).trade * (port.bay ? 1.5 : 1);
    const qty = Math.round(K.orders.qtyShareOfPortTrade * portTrade * (0.6 + 0.8 * hash01(this.orderSeq * 7 + 3)));
    const price = { goods: K.price.goodsExport, mat: K.price.matExport, food: K.price.foodExport }[good];
    this.orders.push({ good, qty, reward: qty * price * K.orders.premium, expires: this.t + K.orders.expireYears * SPY });
    this.orderSeq++; this.nextOrderT = this.t + K.orders.everyYears * SPY / slots;
  }
  deliverOrders() {
    for (const o of [...this.orders]) {
      if (this[o.good] >= o.qty) { this[o.good] -= o.qty; this.money += o.reward; this.earned.orders += o.reward; this.ema.orders += o.reward / 60; this.ema.income += o.reward / 60; this.ema.net += o.reward / 60;
        this.ordersDelivered++; this.orders.splice(this.orders.indexOf(o), 1); this.actions++; }
    }
  }
  tick() {
    this.t += 1;
    if (this.pending.length) {
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const b = this.pending[i];
        if (b.readyAt <= this.t) {
          b.active = b.level; b.builtEra = this.era; this.pending.splice(i, 1); this.dirty = true;
          if (b.type === 'town_center') { this.tcLevel = b.active; if (b.active >= 3) this.enterEra(b.active - 2); }
        }
      }
    }
    if (this.research && this.research.end <= this.t) { this.disc.add(this.research.id); this.research = null; this.dirty = true; }
    if (this.dirty) this.recompute();
    if (this.t % SPY === 0) { this.organicGrowth(); this.newOrders(); this.treasuryCheck(); if (this.dirty) this.recompute(); }
    const s = this.s, bo = this.bonuses(), y = 1 / SPY;
    // ── labour in priority classes: services → food → raw → industry → commerce
    const workers = this.pop * K.workforceShare; let left = workers, jobsAll = 0;
    for (const c of K.labourOrder) { const j = s.jobs[c]; jobsAll += j; this.staff[c] = j > 0 ? Math.min(1, left / j) : 1; left = Math.max(0, left - j); }
    const unemp = workers > 0 ? Math.max(0, workers - jobsAll) / workers : 0;
    const ar = 1;
    // ── energy (flow). Shortfall is bought from the regional grid while money > 0.
    const fuelPower = s.fuelUsePower * this.staff.svc * ar;
    const supply = s.power * this.staff.svc * ar;
    let gridBuy = Math.max(0, s.pu - supply);
    let powerRatio = 1;
    if (gridBuy > 0 && this.money <= 0) { powerRatio = s.pu > 0 ? Math.min(1, supply / s.pu) : 1; gridBuy = 0; }
    // ── traffic
    const trips = (this.pop * K.trips.perCitizen + jobsAll * K.trips.perJob) * (1 - s.transitShare) * (this.dense ? 1 + K.density.trips : 1) * (this.programs.has('autonomous') ? 1 - K.programs.autonomousTrips : 1);
    const rho = trips * K.trips.length * K.trips.hotspot / (s.roadTiles * s.roadCap) * (1 - bo.congestion);
    const congEff = 1 / (1 + K.congestion.effSlope * Math.max(0, rho - 1));
    const congHappy = Math.min(K.congestion.happyCap, K.congestion.happyPerUnit * Math.max(0, rho - 1));
    const gold = this.golden();
    const base = congEff * (1 + bo.prod + gold) * ar * (s.pu > 0 ? 0.6 + 0.4 * powerRatio : 1);
    const effFood = this.staff.food * base, effRaw = this.staff.raw * base, effInd = this.staff.ind * base * (1 + K.charters.craft * s.craft);
    // ── production
    this.food += s.out.food.food * effFood * (1 + bo.food + s.farmBoost) * y;
    this.mat += (s.out.raw.mat * effRaw + s.out.ind.mat * effInd) * (1 + bo.mat) * y;
    this.goods += s.out.ind.goods * effInd * (1 + bo.goods) * y;
    const fuelMade = s.out.raw.fuel * effRaw * y, fuelNeed = (s.fuelUseInd * effInd + fuelPower) * y;
    this.food -= (this.pop * K.foodPerCitizen + s.foodUseInd * effInd) * y;
    let starving = false, costs = 0;
    const imp = 1 - s.importDisc;
    if (this.food < 0) {
      const need = -this.food, cost = need * K.price.foodImport * imp;
      if (this.money >= cost) { costs += cost; this.spent.imports += cost; this.ema.foodImport += need; this.food = 0; }
      else { this.food = 0; starving = true; }
    }
    let fuelSurplus = 0;
    if (fuelNeed > fuelMade) { const c = (fuelNeed - fuelMade) * K.price.fuelImport * imp; costs += c; this.spent.fuel += c; this.ema.fuelImport += (fuelNeed - fuelMade); }
    else fuelSurplus = fuelMade - fuelNeed;
    if (gridBuy > 0) { const c = gridBuy * K.price.grid * y; costs += c; this.spent.energy += c; this.ema.gridImport += gridBuy * y; }
    // ── exports through trade capacity (goods first, then fuel surplus, then food/materials above 90 % of storage)
    const capTotal = s.trade * (1 + bo.trade) * (1 + K.charters.marketTrade * s.marketCh) * this.staff.com * y;
    let cap = capTotal, trade = 0;
    const reserve = g => this.orders.filter(o => o.good === g).reduce((a, o) => a + o.qty, 0);
    const sell = (stock, price, keep) => { const x = Math.max(0, Math.min(stock - keep, cap)); cap -= x; trade += x * price; return x; };
    const freight = Math.min(1, 0.35 * s.stations.length) * K.rail.freightPremium;
    const cargo = this.routes.includes('cargo') ? K.routes.cargoPremium : 0;
    this.goods -= sell(this.goods, K.price.goodsExport * (1 + s.goodsPremium + freight + cargo), Math.min(reserve('goods'), s.storage));
    if (fuelSurplus > 0) sell(fuelSurplus, K.price.fuelExport, 0);
    this.food -= sell(this.food, K.price.foodExport, Math.max(s.storage * K.exportAbove, reserve('food')));
    this.mat -= sell(this.mat, K.price.matExport, Math.max(s.storage * K.exportAbove, reserve('mat')));
    const used = capTotal > 0 ? 1 - cap / capTotal : 1;
    let waste = 0;
    for (const r of ['food', 'mat', 'goods']) if (this[r] > s.storage) { waste += this[r] - s.storage; this[r] = s.storage; }
    // ── happiness (city average; per home in the engine)
    const [taxPol, happyPol] = K.taxPolicy[this.policy];
    const noise = this.count('airport') && this.buildings.some(b => b.type === 'villa' && b.beach) ? 1 : 0;
    const h = clamp(K.happy.base + K.happy.comfort * s.comfortShare + s.aura + s.tcAura + s.metroAppeal + s.roadAppeal + bo.happy + happyPol
      + K.charters.greenHappy * s.green + (gold > 0 ? K.golden.happy : 0) + (this.programs.has('cleanair') ? 2 : 0) + (this.dense ? K.density.happy : 0)
      - s.pollution - congHappy - noise * 0.5 - (starving ? K.happy.starving : 0) - (1 - powerRatio) * K.happy.noPower, 0, 100);
    this.h = h;
    // ── money
    const routesTax = this.routes.filter(r => r === 'business').length * K.routes.businessTax;
    const tax = this.pop * K.tax * s.taxMult * (0.5 + h / 100) * (1 - K.unemploymentTaxLoss * unemp) * taxPol * (1 + bo.tax + gold + K.charters.marketTax * s.marketCh
      + s.dataTax * s.dataCov + routesTax + (this.programs.has('cityos') ? K.programs.cityOsTax : 0)) * y;
    const X = s.tourX, C = s.visitors;
    const tour = (X > 0 && C > 0 ? X * C / (X + C) : 0) * y;
    const fares = this.pop * Math.min(1, s.metroCov) * K.metro.fareShareOfTax * K.tax * s.taxMult * y;
    trade *= 1 + gold;
    const progCost = this.programs.size * K.programs.costShareOfGross * this.ema.income;
    const routeUp = this.routes.length * K.routes.upkeep[Math.max(0, this.countAt('airport', 2) ? 1 : 0)] * y;
    const upkeepPaid = s.upkeep * y;
    const interest = this.loan * K.loan.ratePerYear * y;
    costs += upkeepPaid + progCost + routeUp + interest;
    const income = tax + trade + tour + fares;
    this.money += income - costs;
    this.spent.programs += progCost; this.spent.routes += routeUp; this.spent.interest += interest; this.interestPaid += interest;
    if (this.money < 0) { this.money = 0; this.arrearsTicks++; this.inArrears = true; }
    if (this.loan > 0 && income > costs) { const r = Math.min(this.loan, (income - costs) * K.loan.repayShareOfNet, this.money); this.loan -= r; this.money -= r; }
    this.earned.tax += tax; this.earned.trade += trade; this.earned.tourism += tour; this.earned.fares += fares; this.earned.upkeep += upkeepPaid;
    // ── population: target P* = effective housing × occupancy(happiness)
    const occ = clamp((h - K.occupancy.from) / K.occupancy.span, 0, 1);
    const Pstar = s.Heff * occ; this.Pstar = Pstar; this.occ = occ;
    if (this.pop > Pstar) this.pop = Math.max(Pstar, this.pop - Math.max(0.2, (this.pop - Pstar) * K.moveOut));
    else if (starving) this.pop *= 1 - K.decline;
    else this.pop = Math.min(Pstar, this.pop + (Pstar - this.pop) * K.growthRate * Math.min(1, h / 70) + K.growthFlat);
    this.peakPop = Math.max(this.peakPop, this.pop);
    // ── telemetry (EMAs of per-tick values; ×60 = per game minute, ×25 = per year)
    const a = 1 / 60, e = this.ema;
    e.income += a * (income - e.income); e.net += a * (income - costs - e.net);
    e.tax += a * (tax - e.tax); e.trade += a * (trade - e.trade); e.tour += a * (tour - e.tour); e.fares += a * (fares - e.fares); e.upkeep += a * (costs - e.upkeep);
    e.orders *= 1 - a; e.upk += a * (upkeepPaid - e.upk); e.tourX += a * (X - e.tourX); e.tourC += a * (C - e.tourC);
    e.matImport *= 1 - a; e.foodImport *= 1 - a; e.fuelImport *= 1 - a; e.gridImport *= 1 - a; e.exportUse += a * (used - e.exportUse); e.waste += a * (waste - e.waste);
    this.h50 += (h - this.h50) / (50 * SPY); if (this.t > 50 * SPY) this.bestH50 = Math.max(this.bestH50, this.h50);
    this.staffing = Math.min(...Object.values(this.staff)); this.unemp = unemp; this.rho = rho; this.powerRatio = powerRatio;
    if (this.t % 5 === 0) {
      for (let i = 0; i < GOALS.length; i++) {
        if (this.goalsDone.has(i)) continue;
        const g = GOALS[i]; if (g.era > this.era) continue;
        if (g.test(this)) { this.goalsDone.add(i); this.money += g.reward; this.earned.goals += g.reward; }
      }
      this.trackFlags(h, rho);
    }
  }
  trackFlags(h, rho) {
    const f = this.flags, T = this.flagT;
    if (this.pop >= 50000 && rho < 0.8) f.flow = true;
    if (this.pop >= 50000 && this.s.pollution < 2) f.clean = true;
    if (h >= 90) { T.garden = T.garden ?? this.t; if (this.t - T.garden >= 10 * SPY) f.garden = true; } else T.garden = null;
    const imports = this.ema.foodImport + this.ema.matImport + this.ema.fuelImport + this.ema.gridImport;
    if (this.era === 6 && imports < 0.01) { T.self = T.self ?? this.t; if (this.t - T.self >= 20 * SPY) f.self = true; } else T.self = null;
  }
  enterEra(e) {
    this.era = e; this.dirty = true;
    const year = yearOf(this.t), lead = ERAS[e].hist - year, st = STARS[e];
    const stars = lead >= 0 ? 1 + (year <= st.s2 ? 1 : 0) + (year <= st.s3 ? 1 : 0) : 0;
    this.goldenStart = this.t; this.goldenStars = stars;
    this.entries.push({ era: e, t: this.t, year, lead, stars, pop: this.pop, income: this.ema.income * SPY, net: this.ema.net * SPY,
      strips: this.stripsOwned, buildings: this.buildings.length, actions: this.actions, homeActions: this.homeActions, happy: this.h, money: this.money,
      upkeepShare: this.ema.upkeep / Math.max(1e-9, this.ema.income), upkShare: this.ema.upk / Math.max(1e-9, this.ema.income), landUsed: this.landUse().land, width: this.width });
  }
  gateItemsDone() {
    const g = GATES[this.era + 1]; if (!g) return { done: 0, total: 0 };
    let done = 0;
    for (const it of g.items) if (this.countAt(it.type, it.level) >= it.n && (!it.extra || it.extra(this))) done++;
    const discs = DISC.filter(d => d.era === this.era && this.disc.has(d.id)).length;
    return { done: done + Math.min(GATE_DISC, discs) / GATE_DISC, total: g.items.length + 1 };
  }
  gateMet() {
    const g = GATES[this.era + 1]; if (!g || this.tcLevel === 1) return false;
    if (this.pop < g.pop) return false;
    if (DISC.filter(d => d.era === this.era && this.disc.has(d.id)).length < GATE_DISC) return false;
    for (const it of g.items) if (this.countAt(it.type, it.level) < it.n || (it.extra && !it.extra(this))) return false;
    return true;
  }
  // Live lead (gdd §3.4): E(t) = H_e + f·(H_{e+1} − H_e), f = 0.98 while the Town Hall builds, else 0.95·g
  lead() {
    const e = this.era, Y = yearOf(this.t), H = ERAS[e].hist, Hn = ERAS[e + 1]?.hist;
    if (Hn === undefined) return H - Y;
    const g0 = GATES[e + 1], it = this.gateItemsDone();
    const g = 0.5 * Math.min(1, this.pop / g0.pop) + 0.5 * it.done / it.total;
    const busy = this.pending.some(b => b.type === 'town_center');
    return H + (busy ? 0.98 : 0.95 * g) * (Hn - H) - Y;
  }
  // Score (gdd §12): Chronicle + City + Land + Achievements. Money = 0 points. Every term is bounded.
  score() {
    const starPts = [0, 100, 300, 600];
    const chron = this.entries.slice(1).reduce((a, x) => a + 1000 + Math.max(0, Math.round(x.lead)) + starPts[x.stars], 0);
    const hf = 0.8 + 0.4 * (this.bestH50 || this.h50) / 100;
    const city = Math.round(20 * Math.sqrt(this.peakPop) * hf);
    const land = 100 * this.stripsOwned;
    const ach = ACHIEVEMENTS.filter(a => a[3](this)).length;
    return { total: chron + city + land + 250 * ach, chron, city, land, ach: 250 * ach, achN: ach, hf: hf.toFixed(2) };
  }
}

// ───────────────────────────────────────────────────────────── the player (greedy heuristics)
export const PROFILES = {
  // slow: acts every 40 game-s, keeps idle cash, builds new rather than upgrading, careless zoning, late research
  slow: { name: 'slow', interval: 40, perVisit: 2, reserve: 1.6, covTarget: 0.65, happyTarget: 45, exposure: 0.45, roi: 0.7, landEfficiency: 0.5,
          researchLag: 240, trafficTolerance: 1.4, villas: false, homeUpgradeBias: 1.6, gateEarly: 0.95, stripBuffer: 0.06, taxSmart: false, researchSaveMin: 0, loans: false, afk: 0.15, mistakes: 0.2 },
  // typical: acts every 15 game-s, sensible priorities
  typical: { name: 'typical', interval: 15, perVisit: 3, reserve: 1.15, covTarget: 0.85, happyTarget: 55, exposure: 0.25, roi: 1.5, landEfficiency: 0.62,
          researchLag: 40, trafficTolerance: 1.1, villas: true, homeUpgradeBias: 1, gateEarly: 0.8, stripBuffer: 0.1, taxSmart: false, researchSaveMin: 2, loans: false, afk: 0.05, mistakes: 0.08 },
  // optimised: acts every 3 game-s, spends to zero, zones industry away from homes; best point of the 32-point sweep (§14.4b):
  //            the tax lever and loans did NOT make it faster, so the best expert uses neither
  optimised: { name: 'optimised', interval: 3, perVisit: 6, reserve: 1.0, covTarget: 0.92, happyTarget: 62, exposure: 0.12, roi: 1.8, landEfficiency: 0.72,
          researchLag: 0, trafficTolerance: 0.95, villas: true, homeUpgradeBias: 1.1, gateEarly: 0.85, stripBuffer: 0.14, taxSmart: false, researchSaveMin: 5, loans: false, afk: 0, mistakes: 0 },
};
const perYear = c => c.ema.income * SPY;                         // gross income per year (EMA)

function decide(c) {
  const s = c.s;
  // Advisor (every profile follows it): homes full, land full, cash piling up → "homes need services/upgrades to grow"
  const Pst = c.Pstar ?? s.Heff;
  // Advisor: (a) homes full and land full while cash piles up, or (b) more than 8 years of gross income sits idle
  const stuck = !c.p.noAdvisor && ((c.pop >= Pst * 0.97 && c.freeLand() < 10 && c.money > perYear(c) * 4) || (c.money > perYear(c) * 8 && c.t > 600));
  const p = stuck ? { ...c.p, covTarget: 0.97, happyTarget: 70, homeUpgradeBias: 0.8 } : c.p;
  c.pEff = p;
  if (stuck && c.era >= K.density.era && !c.dense && c.h > 70) c.dense = true;
  const price = (type, opts) => { const l = c.bestLevel(type); return l ? c.totalPrice(c.costOf(type, l)) : Infinity; };
  const guard = (type, l) => HOMES.includes(type) || c.ema.net * SPY >= 0.5 * lvl(type, l).upkeep || c.pop < 12;   // upkeep guard
  const tryBuild = (type, opts) => { const l = c.bestLevel(type); if (!l || !c.canPlace(type, opts) || !guard(type, l)) return false; return c.add(type, l, opts); };
  const buildOrUpgrade = (type, opts) => {
    const l = c.bestLevel(type); if (!l) return false;
    const old = c.buildings.find(b => b.type === type && b.active && b.active < l && b.level === b.active && lvl(type, l).era > lvl(type, b.active).era);
    if (old) return guard(type, l) && c.upgrade(old, l);
    return tryBuild(type, opts);
  };
  c.deliverOrders();
  { const m = c.buildings.find(b => b.mothballed);                 // re-open mothballed buildings once the treasury can carry them
    // the Advisor's "sell surplus" hint: a mothballed generator the city no longer needs is demolished (refund 50 % of paid)
    if (m && lvl(m.type, m.active).power && s.power >= s.pu) { c.demolish(m); return 'demolish-surplus'; }
    if (m && c.ema.net * SPY > 2 * lvl(m.type, m.active).upkeep && c.money > lvl(m.type, m.active).upkeep) { m.mothballed = false; c.dirty = true; c.actions++; return 'unmothball'; } }
  if (p.taxSmart) c.policy = c.h > 78 ? 'high' : c.h < 52 ? 'low' : 'normal';
  if (p.taxSmart && c.era >= K.density.era) c.dense = c.h > 74 || (c.dense && c.h > 66);
  // 1. Town Hall
  const tc = c.buildings.find(b => b.type === 'town_center');
  if (tc.level === tc.active) {
    if (c.tcLevel === 1 && c.pop >= TC2_POP) { if (c.upgrade(tc, 2)) return 'tc2'; return 'save'; }
    if (c.tcLevel >= 2 && c.gateMet() && c.tcLevel < 8) {
      const cost = c.totalPrice(c.costOf('town_center', c.tcLevel + 1));
      if (p.loans && c.money < cost && c.loan === 0 && c.money + perYear(c) * K.loan.maxYearsOfGross >= cost) {
        const amt = cost - c.money + 1; c.loan += amt; c.money += amt; c.loansTaken++;
      }
      if (c.upgrade(tc, c.tcLevel + 1)) return 'era'; return 'save';
    }
  }
  // 2. Food
  const pendingFood = c.pending.reduce((acc, b) => acc + ((lvl(b.type, b.level).food || 0) - (b.active ? lvl(b.type, b.active).food || 0 : 0)), 0);
  const foodNet = (s.out.food.food + pendingFood) * c.staff.food - c.pop * K.foodPerCitizen;
  if (((c.ema.foodImport > 0.02 && pendingFood <= 0) || foodNet < 0) && (c.era <= 1 || c.ema.foodImport * K.price.foodImport > 0.03 * c.ema.income * 60)) {
    const opts = ['farm', 'vertical_farm', 'fishery'].filter(t => c.bestLevel(t));
    opts.sort((a, b) => price(a) / lvl(a, c.bestLevel(a)).food - price(b) / lvl(b, c.bestLevel(b)).food);
    for (const t of opts) if (c.money >= price(t) && buildOrUpgrade(t)) return 'food:' + t;
  }
  // 3. Power: own generation when grid purchases exceed 8 % of gross (the grid always covers the shortfall while money > 0)
  if (s.pu > 0 && (c.ema.gridImport * K.price.grid > 0.03 * c.ema.income * 60 || c.powerRatio < 1)) {
    { const pl = c.bestLevel('power_plant'), o = c.buildings.find(b => b.type === 'power_plant' && b.active && b.active < pl && b.level === b.active);
      if (o) { const cost = c.totalPrice(c.costOf('power_plant', pl, o)); if (c.money >= cost) { if (c.upgrade(o, pl)) return 'power-up'; } else if (cost < perYear(c) * 2) return 'save'; } }
    for (const t of ['power_plant', 'solar_farm', 'windmill']) {
      const l = c.bestLevel(t); if (!l || !lvl(t, l).power) continue;
      const o = B[t].place === 'landOrBeach' ? { beach: true } : {};
      if (!c.canPlace(t, o)) continue;
      if (c.money >= price(t)) { if (tryBuild(t, o)) return 'power'; }
      else if (price(t) < perYear(c) * 2) return 'save';
    }
  }
  // 3b. Fuel: build coal mines / oil wells on free deposits when fuel imports exceed 4 % of gross
  if (c.ema.fuelImport * K.price.fuelImport > 0.04 * c.ema.income * 60) {
    for (const t of ['coal_mine', 'oil_well']) {
      if (!c.bestLevel(t)) continue;
      if (c.canPlace(t)) { if (c.money >= price(t)) { if (tryBuild(t)) return 'fuel:' + t; } else if (price(t) < perYear(c) * 2) return 'save'; }
      else { const o = c.buildings.find(b => b.type === t && b.active < c.bestLevel(t) && b.level === b.active); if (o && c.money >= c.totalPrice(c.costOf(t, c.bestLevel(t), o))) { if (c.upgrade(o, c.bestLevel(t))) return 'fuel-up'; } }
    }
  }
  // 4. Research
  if (!c.research && c.t >= c.lastResearchEnd + p.researchLag) {
    const next = DISC.filter(d => d.era <= c.era && !c.disc.has(d.id))
      .sort((a, b) => (a.era - b.era) || (gatePriority(c, a) - gatePriority(c, b)) || a.cost - b.cost)[0];
    if (next) {
      if (c.money >= c.discCost(next) * p.reserve) { c.startResearch(next); c.lastResearchEnd = c.research.end; return 'research:' + next.id; }
      const g0 = GATES[c.era + 1], popReady = g0 && c.pop >= g0.pop * 0.7;
      const cheap = c.discCost(next) < c.ema.income * 60 * p.researchSaveMin;
      if (next.era < c.era || ((popReady || cheap) && DISC.filter(d => d.era === c.era && c.disc.has(d.id)).length < GATE_DISC)) return 'save';
    }
  }
  // 5. Gate items (each one is the previous era's new verb)
  const g = GATES[c.era + 1];
  if (g && (c.pop >= g.pop * p.gateEarly || c.freeLand() < 30)) {
    for (const it of g.items) {
      const { type, level, n } = it;
      const have = c.countAt(type, level) + c.pending.filter(b => b.type === type && b.level >= level).length;
      if (have >= n) {
        if (type === 'airport' && c.routes.length < 2 && c.countAt('airport', 1)) { const r = openRoute(c); if (r) return r; return 'save'; }
        continue;
      }
      if (!c.levelUnlocked(type, level)) continue;
      if (type === 'rail_station' && c.railTiles === 0) {
        const cost = K.rail.tilesToPortal * TRACK[c.bestRail()].money;
        if (c.money < cost + price(type)) return 'save';
        c.money -= cost; c.spent.transport += cost; c.railTiles = K.rail.tilesToPortal; c.railLevel = c.bestRail(); c.actions++;
      }
      if (type === 'metro_station' && c.count('metro_station') >= 1) {
        const cost = K.metro.tilesPerStation * K.metro.tunnelPerTile;
        if (c.money < cost + price(type)) return 'save';
        c.money -= cost; c.spent.transport += cost; c.metroTunnel += K.metro.tilesPerStation;
      }
      const old = c.buildings.find(b => b.type === type && b.active && b.active < level && b.level === b.active);
      if (old) { if (c.upgrade(old, level)) return 'gate-up:' + type; return 'save'; }
      let opts = type === 'district_hall' ? { charter: 'craft' } : B[type].place === 'landOrBeach' && type === 'glassworks' ? { beach: true } : {};
      if (!c.canPlace(type, opts) && opts.beach) opts = {};      // a full beach: the glassworks goes on land instead
      if (!c.canPlace(type, opts)) break;
      if (c.add(type, level, opts)) return 'gate:' + type;
      return 'save';
    }
  }
  // 5b. Ports deliver orders; stations get a through-line once a second portal strip is owned
  if (c.railTiles > 0 && !c.through && c.feature('portal') >= 2) {
    const cost = K.rail.throughTiles * TRACK[c.railLevel].money;
    if (c.money >= cost * p.reserve * 1.5) { c.money -= cost; c.spent.transport += cost; c.railTiles += K.rail.throughTiles; c.through = true; c.dirty = true; c.actions++; return 'through-line'; }
  }
  // 6. Labour balance
  if (c.staffing < 0.9 && c.staff.com < 0.9 && c.pop > Pst * 0.9) { const r = growHousing(c); if (r && r !== 'save') return r; }
  if (c.unemp > 0.12) { const r = invest(c, true); if (r && r !== 'save') return r; }
  // 6b. Land (the next strip is always the same price on either side; pick the side whose deposit is needed)
  if (c.freeLand() < c.width * 40 * p.stripBuffer || (c.stripsOwned < 2 && c.money > c.stripPrice() * 4 && p.name !== 'slow')) {
    if (c.stripsOwned < STRIPS.count) { if (c.buyStrip(pickSide(c))) return 'strip'; }
  }
  // 7. Services
  for (const sv of SERVICES) {
    if (s.cov[sv] === null || s.cov[sv] >= p.covTarget) continue;
    const types = Object.values(B).filter(b => b.service === sv && c.bestLevel(b.id)).map(b => b.id);
    types.sort((a, b) => price(a) / area(lvl(a, c.bestLevel(a)).r) - price(b) / area(lvl(b, c.bestLevel(b)).r));
    for (const t of types) if (c.money >= price(t) && buildOrUpgrade(t)) return 'service:' + sv;
    const doable = types.filter(t => c.canPlace(t) || c.buildings.some(b => b.type === t && b.active && b.active < c.bestLevel(t) && b.level === b.active));
    if (doable.length && price(doable[0]) < perYear(c) * 7) return 'save';
  }
  // 7b. Transit and data needs (tiers 8 and 10) once the city reaches those levels
  if (c.era >= 5 && s.transitCov < 0.8 && c.bestLevel('metro_station') && c.count('metro_station') >= 2 && c.canPlace('metro_station') && c.money > price('metro_station') * 2.5) {
    const cost = K.metro.tilesPerStation * K.metro.tunnelPerTile; c.money -= cost; c.spent.transport += cost; c.metroTunnel += K.metro.tilesPerStation;
    if (tryBuild('metro_station')) return 'metro:transit';
  }
  if (c.era >= 6 && c.bestLevel('data_center') && s.dataCov < 0.85 && c.money >= price('data_center') && tryBuild('data_center')) return 'data';
  // 8. Happiness
  if (c.h < p.happyTarget || (c.occ < 0.95 && c.money > perYear(c))) {
    if (p.villas && c.bestLevel('villa') && c.canPlace('villa', { beach: true }) && c.money >= price('villa') * 1.5 && tryBuild('villa', { beach: true })) return 'villa';
    if (s.aura < K.happy.auraCap - 1 && c.money >= price('park') && buildOrUpgrade('park')) return 'park';
    if (s.pollution > 8 && c.bestLevel('district_hall') && c.money >= price('district_hall') && c.canPlace('district_hall')) { c.add('district_hall', c.bestLevel('district_hall'), { charter: 'green' }); return 'charter:green'; }
  }
  // 9. Traffic
  if (c.rho > p.trafficTolerance) { const r = fixTraffic(c); if (r) return r; }
  // 10. Housing growth (fix material imports / unemployment first when they are large)
  const importing = c.ema.matImport > 0.3 * (s.out.raw.mat + s.out.ind.mat) * 60 / SPY + 5;
  if (importing || c.unemp > 0.06) { const r = invest(c, c.unemp > 0.06); if (r && r !== 'save') return r; }
  if (c.pop > Pst * 0.9) {
    const home = homeCandidates(c)[0], inv = investCandidates(c, false)[0];
    if (inv && (!home || inv.payback < home.payback * p.roi / 1.5) && inv.payback <= SCALE.prodPaybackYears[c.era] * p.roi) { const r = invest(c, false); if (r) return r; }
    const r = growHousing(c); if (r) return r;
  }
  // 11. Trade & storage
  if (c.ema.exportUse > 0.95 && (c.goods > 120 || c.ema.waste > 0.01)) { const r = buildTrade(c); if (r) return r; }
  const nextTc = lvl('town_center', Math.min(8, c.tcLevel + 1));
  if (c.tcLevel >= 2 && s.storage < nextTc.matCost * 1.1 && c.money >= price('storehouse') && buildOrUpgrade('storehouse', { beach: true })) return 'storage';
  // 12. Investments by payback
  { const r = invest(c, false); if (r) return r; }
  // 13. Era verbs beyond the gate: more charters, more routes, smart programs
  if (c.era >= 2 && c.count('district_hall') < 1 + Math.floor(c.width / 40) && c.bestLevel('district_hall') && c.money > price('district_hall') * 4 && c.canPlace('district_hall')) {
    c.add('district_hall', c.bestLevel('district_hall'), { charter: c.count('district_hall') % 2 ? 'market' : 'craft' }); return 'charter';
  }
  if (c.countAt('airport', 1)) {
    const slots = K.routes.slots[c.buildings.find(b => b.type === 'airport').active - 1];
    if (c.routes.length < slots && c.money > K.routes.open[slots > 2 ? 1 : 0] * 2) { const r = openRoute(c); if (r) return r; }
  }
  { const ap = c.buildings.find(x => x.type === 'airport' && x.active && x.level === x.active), al = c.bestLevel('airport');
    if (ap && al > ap.active && c.money > c.totalPrice(c.costOf('airport', al, ap)) * 1.5 && c.upgrade(ap, al)) return 'airport-up'; }
  { const ml = c.bestLevel('metro_station'), ms = c.buildings.find(x => x.type === 'metro_station' && x.active && x.active < ml && x.level === x.active);
    if (ms && c.money > c.totalPrice(c.costOf('metro_station', ml, ms)) * 3 && c.upgrade(ms, ml)) return 'metro-up'; }
  if (c.era >= 6 && c.disc.has('smart_city') && c.programs.size < K.programs.max && c.ema.net > 0.1 * c.ema.income) {
    for (const pr of ['cityos', 'autonomous', 'cleanair', 'grid']) if (!c.programs.has(pr)) { c.programs.add(pr); c.dirty = true; c.actions++; return 'program:' + pr; }
  }
  // 14. Villas on the beach for tourism (typical/optimised)
  if (p.villas && c.bestLevel('villa') && c.canPlace('villa', { beach: true }) && c.money > price('villa') * 3 && tryBuild('villa', { beach: true })) return 'villa+';
  return null;
}
function openRoute(c) {
  const ap = c.buildings.find(b => b.type === 'airport' && b.active); if (!ap) return null;
  const cost = K.routes.open[ap.active - 1];
  if (c.money < cost) return 'save';
  const kind = ['tourist', 'cargo', 'business', 'tourist'][c.routes.length] ?? 'tourist';
  c.money -= cost; c.spent.routes += cost; c.routes.push(kind); c.dirty = true; c.actions++;
  return 'route:' + kind;
}
function pickSide(c) {
  const want = [];
  if (c.bestLevel('mine') && c.count('mine') >= c.feature('ore')) want.push('ore');
  if (c.era >= 3 && c.count('coal_mine') >= c.feature('coal') && c.ema.fuelImport > 0) want.push('coal');
  if (c.era >= 4 && c.count('oil_well') >= c.feature('oil') && c.ema.fuelImport > 0) want.push('oil');
  if (c.era >= 2 && !c.feature('bay')) want.push('bay');
  if (c.railTiles > 0 && c.feature('portal') < 2) want.push('portal');
  for (const kind of want) for (const side of ['left', 'right']) { const k = c.strips[side]; if (k < 7 && STRIPS[side][k][kind]) return side; }
  return c.strips.left <= c.strips.right ? 'left' : 'right';
}
function gatePriority(c, d) {
  const g = GATES[c.era + 1]; if (!g) return 1;
  return d.unlocks.some(u => g.items.some(it => u.startsWith(it.type + ':'))) ? 0 : 1;
}
function growHousing(c) {
  const cands = homeCandidates(c);
  for (const x of cands) {
    if (c.money < x.cost) return 'save';
    if (c.p.hutskip && x.kind === 'new' && x.lv > 1) {            // exploit test: build an L1 hut, then upgrade straight to the target
      if (!c.add(x.type, 1)) return 'save'; const b = c.buildings[c.buildings.length - 1]; b.active = 1; c.pending.splice(c.pending.indexOf(b), 1);
      if (!c.upgrade(b, x.lv)) return 'save'; return 'home:skip';
    }
    if (x.kind === 'new' ? c.add(x.type, x.lv) : c.upgrade(x.b, x.lv)) return 'home:' + x.kind + ':' + x.type + x.lv;
  }
  return null;
}
function homeCandidates(c) {
  const p = c.pEff || c.p, cands = [];
  for (const type of ['house', 'block', 'tower']) {
    let k = c.bestLevel(type); while (k > 0 && (!c.levelUnlocked(type, k) || !c.tierAllows(type, k))) k--;
    if (k) cands.push({ kind: 'new', type, lv: k, cost: c.totalPrice(c.costOf(type, k)), gain: lvl(type, k).housing });
  }
  for (const type of ['house', 'block', 'tower', 'villa']) {
    const best = c.bestLevel(type); if (!best) continue;
    const olds = c.buildings.filter(b => b.type === type && b.active && b.active < best && b.level === b.active).sort((a, b) => a.active - b.active);
    const old = olds[0]; if (!old) continue;
    let k = best; while (k > old.active && !c.tierAllows(type, k, old)) k--;
    if (k <= old.active) continue;
    const gain = lvl(type, k).housing - lvl(type, old.active).housing;
    if (gain > 0) cands.push({ kind: 'up', type, lv: k, b: old, cost: c.totalPrice(c.costOf(type, k, old)), gain });
  }
  const score = x => x.cost / x.gain * (x.kind === 'up' ? p.homeUpgradeBias : 1);
  const taxPerCitYear = l => K.tax * SCALE.taxMult[l.era] * (B[l.type]?.villa ?? 1) * (0.5 + c.h / 100);
  const out = cands.filter(x => x.kind === 'up' || c.canPlace(x.type));
  out.forEach(x => { x.payback = x.cost / (x.gain * taxPerCitYear(lvl(x.type, x.lv))); });
  out.sort((a, b) => score(a) - score(b));
  if (c.p.mistakes && c.rng() < c.p.mistakes && out.length > 1) out.push(out.shift());
  return out;
}
function producerValue(c, type, level) {                         // money per year this level would add
  const l = lvl(type, level), s = c.s, d = B[type];
  const matShort = c.ema.matImport > 0.02 || c.mat < s.storage * 0.3;
  const matVal = matShort ? c.matImportPrice() : K.price.matExport;
  const foodVal = c.ema.foodImport > 0.01 ? K.price.foodImport : K.price.foodExport;
  const fuelVal = c.ema.fuelImport > 0.01 ? K.price.fuelImport : K.price.fuelExport;
  const spare = s.trade * (1 - c.ema.exportUse);
  const mult = d.deposit ? (c.slots(d.deposit)[c.count(type)] ?? 1) : 1;
  let v = 0;
  if (l.food) v += l.food * foodVal;
  if (l.mat) v += l.mat * mult * matVal;
  if (l.fuel) v += l.fuel * mult * fuelVal;
  if (l.goods) v += l.goods * K.price.goodsExport * (spare > l.goods * 0.5 ? 1 : 0.6);
  if (l.trade) v += (c.goods > 80 || c.ema.exportUse > 0.9) ? l.trade * (c.goods > 80 ? K.price.goodsExport : 2) : 0;
  if (l.input === 'fuel') v -= l.inputUse * K.price.fuelImport;
  if (l.input === 'food') v -= l.inputUse * K.price.foodImport;
  const unemployed = c.pop * K.workforceShare * c.unemp;
  if (l.jobs && unemployed > 0) v += Math.min(l.jobs, unemployed) * K.tax * s.taxMult * (0.5 + c.h / 100) * K.unemploymentTaxLoss / K.workforceShare;
  v -= l.upkeep;
  if (l.pu) v -= l.pu * K.price.grid * 0.5;
  if (l.pollution) v -= l.pollution[1] * 0.02 * c.pop * K.tax * c.p.exposure;
  return v;
}
const INVEST = ['farm', 'fishery', 'forestry', 'quarry', 'mine', 'coal_mine', 'oil_well', 'kiln', 'steel_mill', 'cement_plant', 'composites_plant', 'workshop', 'glassworks', 'chemical_plant', 'electronics_fab', 'market', 'port', 'rail_station', 'storehouse'];
function invest(c, forJobs) {
  const p = c.p;
  if (!forJobs && c.unemp <= 0.02 && c.staffing < 0.98) return null;
  const cands = investCandidates(c, forJobs);
  const x = cands[0];
  const limit = SCALE.prodPaybackYears[c.era] * p.roi * (forJobs ? 2 : 1);
  if (!x || x.payback > limit) return null;
  if (c.money < x.cost * p.reserve) return 'save';
  const opts = x.kind === 'new' && B[x.type].place === 'landOrBeach' ? { beach: true } : {};
  if (x.kind === 'new' ? c.add(x.type, x.lv, opts) : c.upgrade(x.b, x.lv)) return 'invest:' + x.kind + ':' + x.type;
  return null;
}
function investCandidates(c, forJobs) {
  const cands = [];
  if (!forJobs && c.unemp <= 0.02 && c.staffing < 0.98) return cands;
  for (const type of INVEST) {
    const l = c.bestLevel(type); if (!l) continue;
    if (type === 'rail_station' && c.railTiles === 0) continue;
    if (type === 'port' && c.count('port') === 0) continue;       // the first port is a gate item
    const v = producerValue(c, type, l); if (v <= 0) continue;
    const opts = B[type].place === 'landOrBeach' ? { beach: true } : {};
    if (c.canPlace(type, opts)) cands.push({ type, lv: l, cost: c.totalPrice(c.costOf(type, l)), v, kind: 'new' });
    const old = c.buildings.find(b => b.type === type && b.active && b.active < l && b.level === b.active);
    if (old) { const dv = v - Math.max(0, producerValue(c, type, old.active)); if (dv > 0) cands.push({ type, lv: l, b: old, cost: c.totalPrice(c.costOf(type, l, old)), v: dv, kind: 'up' }); }
  }
  cands.forEach(x => x.payback = x.cost / x.v);
  cands.sort((a, b) => a.payback - b.payback);
  if (c.p.mistakes && c.rng() < c.p.mistakes && cands.length > 1) cands.push(cands.shift());
  return cands;
}
function buildTrade(c) {
  const cands = [];
  for (const t of ['port', 'market', 'rail_station', 'airport']) {
    const l = c.bestLevel(t); if (!l) continue;
    if (t === 'rail_station' && c.railTiles === 0) continue;
    const L = lvl(t, l);
    const old = c.buildings.find(b => b.type === t && b.active && b.active < l && b.level === b.active);
    if (old) cands.push({ t, l, b: old, cost: c.totalPrice(c.costOf(t, l, old)), gain: L.trade - (lvl(t, old.active).trade || 0) });
    if (c.canPlace(t) && t !== 'airport') cands.push({ t, l, cost: c.totalPrice(c.costOf(t, l)), gain: L.trade });
  }
  cands.sort((a, b) => a.cost / a.gain - b.cost / b.gain);
  const x = cands[0]; if (!x) return null;
  if (c.money < x.cost * c.p.reserve) return 'save';
  if (x.b ? c.upgrade(x.b, x.l) : c.add(x.t, x.l)) return 'trade:' + x.t;
  return null;
}
function fixTraffic(c) {
  const s = c.s;
  let best = 0; ROADS.street.forEach((r, i) => { if (r.era <= c.era && (!r.tech || c.disc.has(r.tech))) best = i; });
  const roadUp = (from, to) => Math.max(K.upgradeFloor * to.money, to.money - K.tradeIn * from.money);
  if (best > c.street) {
    const cost = s.roadTiles * (1 - c.avenueShare) * roadUp(ROADS.street[c.street], ROADS.street[best]);
    if (c.money >= cost * c.p.reserve) { c.money -= cost; c.spent.roads += cost; c.street = best; c.dirty = true; c.actions += Math.ceil(s.roadTiles / 12); return 'roads:street' + best; }
    return 'save';
  }
  const mlv = c.bestLevel('metro_station');
  if (mlv && c.count('metro_station') >= 2 && s.transitShare < 0.45 && c.canPlace('metro_station')) {
    const tunnel = K.metro.tilesPerStation * K.metro.tunnelPerTile;
    const cost = c.totalPrice(c.costOf('metro_station', mlv)) + tunnel;
    if (c.money >= cost * c.p.reserve) { c.money -= tunnel; c.metroTunnel += K.metro.tilesPerStation; c.spent.transport += tunnel; if (c.add('metro_station', mlv)) return 'metro'; }
    else if (c.avenueShare >= 0.5) return 'save';
  }
  let ab = -1; ROADS.avenue.forEach((r, i) => { if (r.era <= c.era && (!r.tech || c.disc.has(r.tech))) ab = i; });
  if (ab >= 0) {
    if (ab > c.avenueLevel && c.avenueShare > 0) {
      const cost = s.roadTiles * c.avenueShare * roadUp(ROADS.avenue[Math.max(0, c.avenueLevel)], ROADS.avenue[ab]);
      if (c.money >= cost * c.p.reserve) { c.money -= cost; c.spent.roads += cost; c.avenueLevel = ab; c.dirty = true; c.actions += Math.ceil(s.roadTiles * c.avenueShare / 12); return 'roads:avenue-up'; }
      return 'save';
    }
    if (c.avenueShare < 0.5) {
      const r = ROADS.avenue[ab], tiles = Math.ceil(s.roadTiles * 0.05), cost = tiles * (r.money + r.matCost * 2);
      if (c.money >= cost * c.p.reserve) { c.money -= cost; c.spent.roads += cost; c.avenueLevel = Math.max(c.avenueLevel, ab); c.avenueShare = Math.min(0.5, c.avenueShare + 0.05); c.dirty = true; c.actions++; return 'roads:avenue+'; }
      return 'save';
    }
  }
  return null;
}
City.prototype.bestRail = function () { let b = 0; TRACK.forEach((r, i) => { if (r.era <= this.era) b = i; }); return b; };

// ───────────────────────────────────────────────────────────── runners
function act(c) { for (let i = 0; i < c.p.perVisit; i++) { const r = decide(c); if (!r || r === 'save') break; } }
export function run(profile, opts = {}) {
  const prof = typeof profile === 'string' ? PROFILES[profile] : profile;
  const c = new City(prof, opts);
  const maxT = (opts.maxHours ?? 30) * 3600, after = (opts.afterHours ?? 2) * 3600;
  let next = 0, doneAt = null, nextSnap = 0;
  const snaps = [], tele = { banks: [], upk: [], perEra: {} };
  while (c.t < maxT) {
    c.tick();
    if (opts.hook) opts.hook(c);
    if (c.t >= next && !c.afkUntil) {
      if (prof.afk && c.rng() < prof.afk * 0.02) c.afkUntil = c.t + Math.round(300 + c.rng() * 900);   // short AFK spells
      else act(c);
      const j = prof.jitter ?? (opts.seed && opts.seed > 1 ? 0.3 : 0);
      next = c.t + Math.max(1, Math.round(prof.interval * (1 + j * (c.rng() * 2 - 1))));
    }
    if (c.afkUntil && c.t >= c.afkUntil) c.afkUntil = 0;
    if (opts.trace && c.t >= nextSnap) { snaps.push(snapshot(c)); nextSnap += 1800; }
    if (c.t % 60 === 0 && c.ema.income > 0) {
      tele.banks.push(c.money / (c.ema.income * SPY)); tele.upk.push(c.ema.upkeep / c.ema.income);
      const pe = tele.perEra[c.era] = tele.perEra[c.era] || { tax: 0, trade: 0, tour: 0, orders: 0, fares: 0, upk: 0, n: 0, rho: 0, cov: 0, X: 0, C: 0 };
      pe.tax += c.ema.tax; pe.trade += c.ema.trade; pe.tour += c.ema.tour; pe.fares += c.ema.fares; pe.orders += c.ema.orders; pe.upk += c.ema.upkeep; pe.n++;
      pe.rho += c.rho; pe.cov += c.s.comfortShare; pe.X += c.ema.tourX; pe.C += c.ema.tourC;
    }
    if (c.era === 6 && doneAt === null) { doneAt = c.t; if (opts.stopAtNF) break; }
    if (doneAt !== null && c.t > doneAt + after) break;
  }
  c.tele = tele;
  return { c, snaps, doneAt };
}
// Daily mobile player: S sessions per day of `minutes` real minutes at ×2 (game time = 2× real), the calendar FROZEN offline,
// and the Treasury chest at the start of every session: min(1, away/8 h) × 1 year of net, at most once per 25 game years.
function runDaily({ minutes = 20, sessions = 1, maxDays = 60 } = {}) {
  const c = new City(PROFILES.typical); let nd = 0, lastClaim = -1e9, chest = 0, claims = 0;
  const days = [];
  for (let day = 1; day <= maxDays && c.era < 6; day++) {
    for (let k = 0; k < sessions && c.era < 6; k++) {
      const awayH = 24 / sessions - minutes / 60;
      if (c.t - lastClaim >= K.chest.cooldownYears * SPY && c.ema.net > 0) {
        const gift = Math.min(1, awayH / K.chest.fillRealHours) * K.chest.maxYearsOfNet * c.ema.net * SPY;
        c.money += gift; c.earned.chest += gift; chest += gift; claims++; lastClaim = c.t;
      }
      const end = c.t + minutes * 60 * 2;
      while (c.t < end) { c.tick(); if (c.t >= nd) { act(c); nd = c.t + c.p.interval; } if (c.era === 6) break; }
    }
    days.push({ day, era: c.era, year: Math.floor(yearOf(c.t)) });
  }
  return { c, days, chest, claims };
}
function snapshot(c) {
  return { min: Math.round(c.t / 60), year: Math.floor(yearOf(c.t)), era: c.era, pop: Math.round(c.pop), happy: Math.round(c.h), lead: Math.round(c.lead()),
    money: fmt(c.money), 'gross/yr': fmt(c.ema.income * SPY), 'net/yr': fmt(c.ema.net * SPY), tax: fmt(c.ema.tax * SPY), trade: fmt(c.ema.trade * SPY), tourism: fmt(c.ema.tour * SPY),
    'costs/yr': fmt(c.ema.upkeep * SPY), strips: c.stripsOwned, bld: c.buildings.length, unemp: c.unemp.toFixed(2), rho: c.rho.toFixed(2),
    'cov W/H/E/L': Object.values(c.s.cov).map(x => x === null ? '-' : x.toFixed(1)).join('/'), street: 'S' + (c.street + 1), 'avenue %': Math.round(c.avenueShare * 100), metro: c.count('metro_station') };
}

// ───────────────────────────────────────────────────────────── spatial capacity pass (gdd §14.8)
// Lays the 40 land rows of a W-wide city out as 4-deep lots between road rows (y = 2, 7, 12, …, 37) with a cross street every
// 12 columns; rows 0–1 are the mountain-foot industry belt. For each service it places the era's best building greedily
// ("cover the first uncovered lot tile with the footprint that covers most new tiles"), stamping exact Manhattan diamonds from
// every footprint tile. Remaining lots are split into workplaces (share measured in the aggregate run) and homes at the best
// housing density allowed when every need is met. Capacity = home tiles × housing per tile × (1 + housing bonus).
function spatialCapacity(era, strips, jobShare, opts = {}) {
  const W = 30 + 5 * strips, H = 40, N = W * H, g = new Uint8Array(N); // 0 lot, 1 road, 2 belt, 3 service, 9 TH
  const roadRow = y => y >= 2 && (y - 2) % 5 === 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (y < 2) g[i] = 2; else if (roadRow(y) || (x % 12 === 11)) g[i] = 1;
  }
  const cx = Math.floor(W / 2) - 1; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g[(19 + dy) * W + cx + dx] = 9;
  const radiusOf = (type) => { let r = 0, sz = 1; B[type].levels.forEach((l, i) => { if (l.era <= era && l.r) { r = l.r; sz = B[type].size[0]; } }); return { r, sz }; };
  const svcTypes = { water: ['well'], health: ['clinic'], education: ['school'], leisure: ['theater', 'temple'] };
  if (era >= 6 && opts.data !== false) svcTypes.data = ['data_center'];
  const rDelta = opts.rDelta ?? 0;
  let placedArea = 0, placedTiles = 0, nPlaced = 0, nSvc = 0;
  const nominal = (r, sz) => { let n = 0; for (let dy = -r; dy < sz + r; dy++) for (let dx = -r; dx < sz + r; dx++) { const ddx = dx < 0 ? -dx : dx > sz - 1 ? dx - sz + 1 : 0, ddy = dy < 0 ? -dy : dy > sz - 1 ? dy - sz + 1 : 0; if (ddx + ddy <= r && !(dx >= 0 && dx < sz && dy >= 0 && dy < sz)) n++; } return n; };
  for (const [sv, types] of Object.entries(svcTypes)) {
    if (sv === 'health' && era < 1) continue;
    let best = { r: 0, sz: 1 }; for (const t of types) { const x = radiusOf(t); if (x.r > best.r) best = x; }
    const r = Math.max(1, best.r + rDelta), sz = best.sz; if (!best.r) continue; nSvc++;
    const cov = new Uint8Array(N);
    const fits = (x, y) => { if (x < 0 || y < 2 || x + sz > W || y + sz > H) return false; for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (g[(y + dy) * W + x + dx] !== 0) return false; return true; };
    const gain = (x, y, apply) => {
      let n = 0;
      for (let ty = Math.max(2, y - r); ty <= Math.min(H - 1, y + sz - 1 + r); ty++) for (let tx = Math.max(0, x - r); tx <= Math.min(W - 1, x + sz - 1 + r); tx++) {
        const ddx = tx < x ? x - tx : tx > x + sz - 1 ? tx - (x + sz - 1) : 0, ddy = ty < y ? y - ty : ty > y + sz - 1 ? ty - (y + sz - 1) : 0;
        if (ddx + ddy > r) continue; const i = ty * W + tx;
        if (g[i] === 0 && !cov[i]) { n++; if (apply) cov[i] = 1; }
      }
      return n;
    };
    for (let i0 = 0; i0 < N; i0++) {
      if (g[i0] !== 0 || cov[i0]) continue;
      const x0 = i0 % W, y0 = Math.floor(i0 / W); let bx = -1, by = -1, bg = 0;
      for (let y = y0 - r - sz; y <= y0 + r; y++) for (let x = x0 - r - sz; x <= x0 + r; x++) {
        if (!fits(x, y)) continue; const n = gain(x, y, false); if (n > bg) { bg = n; bx = x; by = y; }
      }
      if (bx < 0) { g[i0] = 4; continue; }
      for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) g[(by + dy) * W + bx + dx] = 3;
      gain(bx, by, true); nPlaced++; placedArea += nominal(r, sz); placedTiles += sz * sz;
    }
  }
  let lots = 0, roads = 0; for (let i = 0; i < N; i++) { if (g[i] === 0) lots++; if (g[i] === 1) roads++; }
  const homeTiles = Math.floor(lots * (1 - jobShare));
  let hpt = 0, bestHome = '';
  for (const type of ['house', 'block', 'tower']) B[type].levels.forEach((l, i) => {
    if (l.era > era || (l.tier === 10 && era < 6)) return;
    const v = l.housing / (B[type].size[0] * B[type].size[1]); if (v > hpt) { hpt = v; bestHome = `${type} L${i + 1}`; }
  });
  const bonus = era >= 5 ? 0.05 : 0;
  const cap = homeTiles * hpt * (1 + bonus);
  // coverage efficiency: covered home tiles per diamond tile actually stamped (1.0 = perfect tiling)
  const effCov = homeTiles * nSvc / Math.max(1, placedArea);   // comparable with the aggregate constant coverageEfficiency (0.45)
  return { W, lots, roads, roadShare: roads / (W * 38), serviceTiles: placedTiles, nServices: nPlaced, homeTiles, hpt, bestHome, cap, dense: cap * (1 + K.density.housing), effCov };
}

// ───────────────────────────────────────────────────────────── main
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
function line(cols) { return '| ' + cols.join(' | ') + ' |'; }
function deriveStars(byProfile) {
  const out = [null];
  for (let e = 1; e <= 6; e++) {
    const ys = n => byProfile[n].map(r => r.c.entries.find(x => x.era === e)?.year ?? Infinity);
    // ★★ = typical median × 1.05; ★★★ = the best of the 10 typical/optimised runs × 1.02 (always reached by a simulated expert)
    const s2 = Math.round(median(ys('typical')) * 1.05);
    const s3 = Math.min(s2 - 1, Math.round(Math.min(...ys('typical'), ...ys('optimised')) * 1.02));
    out.push({ s2, s3 });
  }
  return out;
}
function main() {
  const args = process.argv.slice(2), quick = args.includes('--quick');
  const t0 = Date.now();
  if (args.includes('--roster')) printRoster();
  const SEEDS = quick ? [1] : [1, 2, 3, 4, 5];
  // ── pass 1 & 2: run every profile over 5 seeds, derive star thresholds, re-run with them (stability check)
  let runs, starsBefore = JSON.stringify(STARS);
  for (let pass = 1; pass <= (quick ? 1 : 3); pass++) {
    runs = {};
    for (const n of ['slow', 'typical', 'optimised']) runs[n] = SEEDS.map(seed => run(n, { seed, afterHours: seed === 1 ? 2 : 0.01, trace: n === 'typical' && seed === 1 }));
    if (quick) break;
    const derived = deriveStars(runs);
    const delta = Math.max(...derived.slice(1).map((d, i) => Math.max(Math.abs(d.s2 - STARS[i + 1].s2) / STARS[i + 1].s2, Math.abs(d.s3 - STARS[i + 1].s3) / STARS[i + 1].s3)));
    console.log(`\n<!-- star pass ${pass}: max change of a threshold ${(delta * 100).toFixed(1)} % -->`);
    STARS = derived;
    if (delta < 0.02) break;
  }
  const ref = Object.fromEntries(Object.entries(runs).map(([n, rs]) => [n, rs[0]]));
  console.log('\n## 14.2 Pacing (seed 1; real minutes at ×1 = game minutes; year = calendar year at entry; lead = historical year − entry year)\n');
  console.log(line(['profile', 'era entered', 'min @1×', 'h:mm', 'year', 'lead', 'stars', 'pop', 'gross/yr', 'net/yr', 'net/month', 'costs % of gross', 'strips', 'buildings', 'actions', 'taps with bulk']));
  console.log('|---|---|---:|---:|---:|---:|:---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [name, r] of Object.entries(ref)) for (const e of r.c.entries.slice(1)) {
    const m = e.t / 60, taps = Math.round(e.actions - e.homeActions + e.homeActions / 6);
    console.log(line([name, ERAS[e.era].en, m.toFixed(0), `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`, Math.floor(e.year), Math.round(e.lead), '★'.repeat(e.stars) || '–',
      fmt(e.pop), fmt(e.income), fmt(e.net), fmt(e.net / 12), Math.round(e.upkeepShare * 100) + '%', e.strips, e.buildings, e.actions, taps]));
  }
  console.log('\n### Era lengths (minutes at ×1; median of the seeds, seed 1 in brackets)\n');
  console.log(line(['era', 'slow', 'typical', 'optimised'])); console.log('|---|---:|---:|---:|');
  const len = (r, e) => { const en = r.c.entries, a = en.find(x => x.era === e), b = en.find(x => x.era === e + 1); return a && b ? (b.t - a.t) / 60 : NaN; };
  for (let e = 0; e < 6; e++) console.log(line([ERAS[e].en, ...['slow', 'typical', 'optimised'].map(n => `${Math.round(median(runs[n].map(r => len(r, e))))} (${Math.round(len(ref[n], e))})`)]));
  const tot = r => { const x = r.c.entries.find(e => e.era === 6); return x ? x.t / 60 : NaN; };
  console.log(line(['**total to the Near Future**', ...['slow', 'typical', 'optimised'].map(n => { const m = median(runs[n].map(tot)); return `**${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min** (${Math.round(tot(ref[n]))})`; })]));
  console.log('\n## 14.3 Seed spread (5 seeds: decision-interval jitter ±30 %, random AFK spells, mistakes) and the derived star thresholds\n');
  console.log(line(['era', 'slow: year (min–max)', 'typical: year (min–max)', 'optimised: year (min–max)', 'typical: minutes (min–max)', '★ = history', '★★ ≤ (typical median × 1.05)', '★★★ ≤ (best typical/optimised run × 1.02)']));
  console.log('|---|---|---|---|---|---:|---:|---:|');
  for (let e = 1; e <= 6; e++) {
    const ys = n => runs[n].map(r => r.c.entries.find(x => x.era === e)?.year).filter(Boolean);
    const ms = runs.typical.map(r => r.c.entries.find(x => x.era === e)?.t / 60).filter(Boolean);
    const rng = a => a.length ? `${Math.round(median(a))} (${Math.round(Math.min(...a))}–${Math.round(Math.max(...a))})` : '—';
    console.log(line([ERAS[e].en, rng(ys('slow')), rng(ys('typical')), rng(ys('optimised')), rng(ms), ERAS[e].hist, STARS[e].s2, STARS[e].s3]));
  }
  console.log('\nStar data for eras.json: ' + JSON.stringify(STARS.slice(1).map(s => [s.s2, s.s3])));
  console.log('\n## 14.3b Entry time per profile (medians of 5 seeds; "stars" = how many of the 5 runs earned ★ / ★★ / ★★★)\n');
  console.log(line(['era', 'slow: min', 'year', 'stars', 'typical: min', 'year', 'stars', 'optimised: min', 'year', 'stars']));
  console.log('|---|---:|---:|---|---:|---:|---|---:|---:|---|');
  for (let e = 1; e <= 6; e++) {
    const cells = [];
    for (const n of ['slow', 'typical', 'optimised']) {
      const en = runs[n].map(r => r.c.entries.find(x => x.era === e)).filter(Boolean);
      const dist = [1, 2, 3].map(k => en.filter(x => x.stars === k).length).join('/');
      cells.push(Math.round(median(en.map(x => x.t / 60))), Math.round(median(en.map(x => x.year))), dist);
    }
    console.log(line([ERAS[e].en, ...cells]));
  }
  console.log('\n## 14.5 End state (2 h of play after entering the Near Future) and score\n');
  console.log(line(['profile', 'game h', 'year', 'pop', 'happiness', 'gross/yr', 'costs/yr', 'money', 'strips', 'buildings', 'organic level-ups', 'score', 'Chronicle', 'City', 'Land', 'Achievements', 'Chronicle share']));
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [name, r] of Object.entries(ref)) {
    const c = r.c, sc = c.score();
    console.log(line([name, (c.t / 3600).toFixed(1), Math.floor(yearOf(c.t)), fmt(c.pop), Math.round(c.h), fmt(c.ema.income * SPY), fmt(c.ema.upkeep * SPY), fmt(c.money), c.stripsOwned, c.buildings.length, c.organicUps,
      fmt(sc.total), fmt(sc.chron), `${fmt(sc.city)} (×${sc.hf})`, fmt(sc.land), `${fmt(sc.ach)} (${sc.achN})`, Math.round(100 * sc.chron / sc.total) + '%']));
  }
  console.log('\n## 14.6 Where the money went (whole run, seed 1)\n');
  console.log(line(['profile', 'tax', 'trade', 'tourism', 'orders', 'fares', 'goals', 'upkeep', 'build', 'upgrade', 'Town Hall', 'research', 'strips', 'roads', 'rail+metro', 'imports (mat+food)', 'fuel', 'grid', 'routes+programs']));
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [name, r] of Object.entries(ref)) { const e = r.c.earned, s = r.c.spent;
    console.log(line([name, fmt(e.tax), fmt(e.trade), fmt(e.tourism), fmt(e.orders), fmt(e.fares), fmt(e.goals), fmt(e.upkeep), fmt(s.build), fmt(s.upgrade), fmt(s.tc), fmt(s.research), fmt(s.strips), fmt(s.roads), fmt(s.transport), fmt(s.imports), fmt(s.fuel), fmt(s.energy), fmt(s.routes + s.programs)])); }
  console.log('\n## 14.6b Economy health (sampled every game minute)\n');
  console.log(line(['profile', 'median bank (years of gross)', '90th pct', 'costs / gross (median)', 'per era: tax / trade / tourism / orders+fares %, costs %']));
  console.log('|---|---:|---:|---:|---|');
  for (const [name, r] of Object.entries(ref)) {
    const t = r.c.tele;
    const mix = Object.entries(t.perEra).map(([e, v]) => { const g = v.tax + v.trade + v.tour + v.fares + v.orders; return `${ERAS[e].id}: ${Math.round(100 * v.tax / g)}/${Math.round(100 * v.trade / g)}/${Math.round(100 * v.tour / g)}/${Math.round(100 * (v.orders + v.fares) / g)}, ${Math.round(100 * v.upk / g)}%`; }).join(' · ');
    console.log(line([name, q(t.banks, 0.5).toFixed(2), q(t.banks, 0.9).toFixed(2), (100 * q(t.upk, 0.5)).toFixed(0) + '%', mix]));
  }
  console.log('\nTourism saturation (typical, era averages): ' + Object.entries(ref.typical.c.tele.perEra).map(([e, v]) => `${ERAS[e].id}: demand X ${fmt(v.X / v.n)}/yr, capacity C ${fmt(v.C / v.n)}/yr → earned ${Math.round(100 * SPY * (v.tour / v.n) / Math.max(1e-9, v.X / v.n))} % of X`).join(' · '));
  console.log('Traffic and coverage (typical, era averages): ' + Object.entries(ref.typical.c.tele.perEra).map(([e, v]) => `${ERAS[e].id}: ρ ${(v.rho / v.n).toFixed(2)}, service share ${(v.cov / v.n).toFixed(2)}`).join(' · '));
  console.log(`Loans (optimised): ${ref.optimised.c.loansTaken} taken, interest paid ${fmt(ref.optimised.c.interestPaid)}. Seconds with an empty treasury: slow ${ref.slow.c.arrearsTicks}, typical ${ref.typical.c.arrearsTicks}, optimised ${ref.optimised.c.arrearsTicks}; mothballed by the treasury: ${['slow','typical','optimised'].map(n => ref[n].c.mothballs || 0).join(' / ')}.`);
  for (const n of ['typical', 'optimised']) { const c = ref[n].c; const e6 = c.entries.find(x => x.era === 6); console.log(`${n} at NF entry: building upkeep ${e6 ? Math.round(100 * e6.upkShare) : '—'} % of gross, all costs ${e6 ? Math.round(100 * e6.upkeepShare) : '—'} %; power supply ${fmt(c.s.power)} vs use ${fmt(c.s.pu)}`); }
  console.log(`Port orders delivered (typical): ${ref.typical.c.ordersDelivered}; flight routes: ${ref.typical.c.routes.join(', ')}; smart programs: ${[...ref.typical.c.programs].join(', ')}; through-line: ${ref.typical.c.through}.`);
  if (quick) { console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`); return; }
  // ── 14.4 trace
  console.log('\n## 14.4 Typical player trace (every 30 game minutes, seed 1)\n');
  const snaps = ref.typical.snaps, keys = Object.keys(snaps[0]);
  console.log(line(keys)); console.log('|' + keys.map(() => '---:').join('|') + '|');
  for (const sn of snaps) console.log(line(keys.map(k => sn[k])));
  // ── daily player
  console.log('\n## 14.7 Daily mobile players (calendar frozen offline; Treasury chest ≤ 1 year of net, once per 25 game years)\n');
  const d1 = runDaily({ minutes: 20, sessions: 1 }), d3 = runDaily({ minutes: 10, sessions: 3 });
  console.log(line(['era', '20 min/day ×2: day', 'year', 'lead', 'stars', '3 × 10 min/day ×2: day', 'year', 'stars'])); console.log('|---|---:|---:|---:|:---:|---:|---:|:---:|');
  for (let e = 1; e <= 6; e++) {
    const a = d1.c.entries.find(x => x.era === e), b = d3.c.entries.find(x => x.era === e);
    const da = a ? d1.days.find(x => x.era >= e)?.day : '—', db = b ? d3.days.find(x => x.era >= e)?.day : '—';
    console.log(line([ERAS[e].en, da ?? '—', a ? Math.floor(a.year) : '—', a ? Math.round(a.lead) : '—', a ? '★'.repeat(a.stars) || '–' : '—', db ?? '—', b ? Math.floor(b.year) : '—', b ? '★'.repeat(b.stars) || '–' : '—']));
  }
  const share = (d) => (100 * d.chest / (d.c.earned.tax + d.c.earned.trade + d.c.earned.tourism + d.c.earned.orders + d.c.earned.fares)).toFixed(1);
  console.log(`\nChest: 1 session/day ${d1.claims} claims = ${share(d1)} % of all income; 3 sessions/day ${d3.claims} claims = ${share(d3)} % of all income (the farming test).`);
  // ── robustness: exploits, perturbations, stress
  console.log('\n## 14.9 Robustness pass (typical profile, seed 1; "NF min" = minutes at ×1 to enter the Near Future)\n');
  const base = run('typical', { seed: 1, stopAtNF: true }), nfMin = r => r.doneAt ? Math.round(r.doneAt / 60) : '>1800';
  const baseNF = base.doneAt / 60;
  const rows = [];
  const rel = r => r.doneAt ? ((r.doneAt / 60 / baseNF - 1) * 100).toFixed(1) + ' %' : '—';
  const exp = (name, prof, opts = {}, note = '') => { const r = run({ ...PROFILES.typical, ...prof }, { seed: 1, stopAtNF: true, ...opts }); rows.push([name, nfMin(r), rel(r), r.c.entries.map(e => '★'.repeat(e.stars)).slice(1).join(' '), note(r.c)]); return r; };
  rows.push(['baseline typical', nfMin(base), '0 %', base.c.entries.map(e => '★'.repeat(e.stars)).slice(1).join(' '), `score ${fmt(base.c.score().total)}`]);
  // E1 amphitheatre carpet: from the Industrial era every free beach tile gets an Antiquity amphitheatre
  exp('E1 amphitheatre carpet on the beach from e1800', {}, { hook: c => { if (c.era >= 3 && c.t % 30 === 0 && c.canPlace('theater', { beach: true }) && c.money > lvl('theater', 1).money * 2) { const b = { uid: ++c.uid, type: 'theater', level: 1, active: 0, readyAt: c.t + 14, beach: true, paid: 0, builtEra: c.era, mult: 1, organic: 0 }; if (c.pay(c.costOf('theater', 1), 'build', b)) { c.buildings.push(b); c.pending.push(b); } } } },
    c => `${c.count('theater')} theatres, tourism ${fmt(c.ema.tour * SPY)}/yr`);
  // E2 hut-skip: every new home is built as an L1 hut and upgraded straight to the target level
  exp('E2 hut-skip (L1 then upgrade to target)', { hutskip: true }, {}, c => `upgrade spend ${fmt(c.spent.upgrade)}`);
  // E3 refund loop: demolish 30 organically-grown homes per era for refunds
  exp('E3 demolish organically grown homes for refunds', {}, { hook: c => { if (c.t % (40 * SPY) === 0 && c.era >= 2) { let n = 0; for (const b of [...c.buildings]) if (b.type === 'house' && b.active >= 3 && b.paid < lvl('house', b.active).money * 0.5 && n < 30) { c.demolish(b); n++; } } } },
    c => `refunds ${fmt(c.earned.refunds)} vs list value destroyed`);
  // E4 park carpet: beach full of top-level parks (the old 10×Σlevels score term)
  exp('E4 park carpet on the beach (score test)', {}, { hook: c => { if (c.t % 30 === 0 && c.canPlace('park', { beach: true }) && c.money > lvl('park', c.bestLevel('park')).money * 3) c.add('park', c.bestLevel('park'), { beach: true }); } },
    c => `score ${fmt(c.score().total)} (baseline ${fmt(base.c.score().total)})`);
  exp('E5 high tax always', {}, { hook: c => { c.policy = 'high'; } }, c => `happiness ${Math.round(c.h)}`);
  exp('E6 loan farming (max loan held as cash)', { loans: true }, { hook: c => { if (c.loan === 0 && c.t % SPY === 0 && c.ema.income > 0) { const a = perYear(c) * K.loan.maxYearsOfGross; c.loan += a; c.money += a; c.loansTaken++; } } },
    c => `${c.loansTaken} loans, interest ${fmt(c.interestPaid)}`);
  exp('E7 lazy: never pays for home upgrades (organic only)', { homeUpgradeBias: 1e9 }, {}, c => `organic level-ups ${c.organicUps}`);
  exp('E8 never follows the Advisor hint', { noAdvisor: true }, {}, c => '');
  // perturbations ±20 % on the aspatial approximations and key constants
  const pert = (name, patch, note) => { const saved = JSON.parse(JSON.stringify(K)); patch(); const r = run('typical', { seed: 1, stopAtNF: true }); Object.assign(K, saved); rows.push([name, nfMin(r), rel(r), r.c.entries.map(e => '★'.repeat(e.stars)).slice(1).join(' '), note ?? '']); };
  pert('P1 coverage efficiency −20 % (0.36)', () => { K.coverageEfficiency *= 0.8; });
  pert('P2 coverage efficiency +20 % (0.54)', () => { K.coverageEfficiency *= 1.2; });
  pert('P3 road capacity −20 %', () => { K.trips.length *= 1.25; });
  pert('P4 upkeep +25 %', () => { for (const k in K.upkeepPerYear) K.upkeepPerYear[k] *= 1.25; for (const b of Object.values(B)) for (const l of b.levels) l.upkeep *= 1.25; }, '');
  for (const b of Object.values(B)) for (const l of b.levels) l.upkeep = b.id === 'town_center' ? 0 : nice2(l.money * (K.upkeepPerYear[b.cat] ?? 0.006) * K.upkeepEraMult[l.era]);
  pert('P5 taxes −10 %', () => { K.tax *= 0.9; });
  pert('P6 organic growth off', () => { K.organicPerYear = 0; });
  pert('P7 tourism capacity ×0.5', () => { for (const b of Object.values(B)) for (const l of b.levels) if (l.visitors) l.visitors *= 0.5; });
  restoreVisitors();
  console.log(line(['test', 'NF min', 'Δ vs baseline', 'stars per era', 'note'])); console.log('|---|---:|---:|---|---|');
  for (const r of rows) console.log(line(r));
  // stress test: a reckless burst of upkeep in the Modern era, then 150 game years of autopilot (no decisions)
  console.log('\n### 14.9b Stress test: arrears and recovery\n');
  // The burst adds free coal power plants until their upkeep + fuel exceeds 1.5 × the city's gross income, so the net goes
  // deeply negative, the treasury empties and the mothballing rule (gdd §4.10) must bring the city back on its own.
  let burst = false, burstT = 0, minH = 100, minNet = 0, positiveAgain = null, afkEnd = 0, added = 0, nAdded = 0, popAtBurst = 0, minPop = Infinity;
  const st = run('typical', { seed: 1, stopAtNF: true, hook: c => {
    if (!burst && c.era === 4 && c.pop > 9000) {
      burst = true; burstT = c.t; popAtBurst = c.pop;
      const l = lvl('power_plant', 1), each = l.upkeep + l.fuelUse * K.price.fuelImport, target = 1.5 * c.ema.income * SPY;
      while (added < target) { c.buildings.push({ uid: ++c.uid, type: 'power_plant', level: 1, active: 1, readyAt: c.t, beach: false, paid: 0, builtEra: c.era, mult: 1, organic: 0 }); added += each; nAdded++; }
      c.money = 0; c.dirty = true; c.afkUntil = c.t + 150 * SPY; afkEnd = c.afkUntil;
    }
    if (burst) {
      minH = Math.min(minH, c.h); minNet = Math.min(minNet, c.ema.net * SPY); minPop = Math.min(minPop, c.pop);
      if (positiveAgain === null && c.t > burstT + 2 * SPY && c.ema.net > 0) positiveAgain = c.t;
    }
  } });
  const sc = st.c;
  console.log(`Burst at minute ${Math.round(burstT / 60)} (year ${Math.floor(yearOf(burstT))}): +${nAdded} coal power plants for free (upkeep + fuel ${fmt(added)}/yr = 1.5 × gross), money set to 0, then 150 game years without any decision.`);
  console.log(`Seconds in arrears: ${sc.arrearsTicks}; buildings mothballed by the treasury rule: ${sc.mothballs || 0}; worst net ${fmt(minNet)}/yr; money never below 0; ` +
    `net positive again ${positiveAgain ? Math.round((positiveAgain - burstT) / SPY) : '—'} years after the burst (while still on autopilot); lowest happiness ${Math.round(minH)}; ` +
    `lowest population ${fmt(minPop)} (${Math.round(100 * minPop / popAtBurst)} % of the population at the burst); Near Future reached at minute ${st.doneAt ? Math.round(st.doneAt / 60) : '—'} (baseline ${Math.round(baseNF)}).`);
  // ── sweep (optimised settings)
  console.log('\n## 14.4b 32-point sweep around the optimised profile (minutes to the Near Future, seed 1)\n');
  const sweep = [];
  for (const interval of [3, 8]) for (const roi of [1.2, 1.8]) for (const reserve of [1.0, 1.15]) for (const taxSmart of [false, true]) for (const loans of [false, true]) {
    const r = run({ ...PROFILES.optimised, interval, roi, reserve, taxSmart, loans }, { seed: 1, stopAtNF: true });
    sweep.push({ interval, roi, reserve, taxSmart, loans, min: r.doneAt ? r.doneAt / 60 : 9999 });
  }
  sweep.sort((a, b) => a.min - b.min);
  console.log(`span ${Math.round(sweep[0].min)}–${Math.round(sweep[sweep.length - 1].min)} min; best: ${JSON.stringify(sweep[0])}; median ${Math.round(median(sweep.map(x => x.min)))}`);
  const avg = f => Math.round(sweep.filter(f).reduce((a, x) => a + x.min, 0) / sweep.filter(f).length);
  console.log(`mean with tax lever ${avg(x => x.taxSmart)} vs without ${avg(x => !x.taxSmart)}; with loans ${avg(x => x.loans)} vs without ${avg(x => !x.loans)}; interval 3 s ${avg(x => x.interval === 3)} vs 8 s ${avg(x => x.interval === 8)}`);
  // ── spatial capacity
  console.log('\n## 14.8 Spatial capacity check of the population gates (real 40-row layout, exact Manhattan diamonds)\n');
  console.log(line(['gate (into)', 'pop gate', 'content era', 'strips (typical at entry)', 'best home', 'lots / road share', 'services placed', 'coverage efficiency', 'capacity', 'gate / capacity', 'full map capacity', 'gate / full map', 'with density policy'])); console.log('|---|---:|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|');
  const typ = ref.typical.c;
  for (let e = 1; e <= 6; e++) {
    const entry = typ.entries.find(x => x.era === e), stripsAt = entry ? entry.strips : 14;
    const sc1 = spatialCapacity(e - 1, stripsAt, 0.35), sc2 = spatialCapacity(e - 1, 14, 0.35);
    console.log(line([ERAS[e].en, fmt(GATES[e].pop), ERAS[e - 1].id, stripsAt, sc1.bestHome, `${sc1.lots} / ${Math.round(sc1.roadShare * 100)} %`, sc1.nServices, sc1.effCov.toFixed(2), fmt(sc1.cap), Math.round(100 * GATES[e].pop / sc1.cap) + ' %', fmt(sc2.cap), Math.round(100 * GATES[e].pop / sc2.cap) + ' %', fmt(sc1.dense)]));
  }
  const r1 = spatialCapacity(5, 14, 0.35, { rDelta: -1 });
  console.log(`\nSensitivity: all service radii −1 → Contemporary-content full-map capacity ${fmt(r1.cap)} (${Math.round(100 * GATES[6].pop / r1.cap)} % used by the Near Future gate). Workplace share of lots assumed 35 % (aggregate runs: ${Math.round(100 * jobShareOf(typ))} %).`);
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
const VISITORS0 = {}; for (const b of Object.values(B)) b.levels.forEach((l, i) => { if (l.visitors) VISITORS0[b.id + i] = l.visitors; });
function restoreVisitors() { for (const b of Object.values(B)) b.levels.forEach((l, i) => { if (VISITORS0[b.id + i]) l.visitors = VISITORS0[b.id + i]; }); }
function jobShareOf(c) {
  let homes = 0, work = 0;
  for (const b of c.buildings) { const d = B[b.type], t = d.size[0] * d.size[1]; if (b.beach || ['coast', 'airportPlot', 'mountain'].includes(d.place)) continue; if (d.cat === 'housing') homes += t; else if (!d.service) work += t; }
  return work / Math.max(1, homes + work);
}

// ───────────────────────────────────────────────────────────── content tables (markdown) for gdd.md
function printRoster() {
  console.log('\n## Era scaling (§5.7)\n');
  console.log(line(['era', 'M (cost ×)', 'cost per citizen (home)', 'tax mult (home level era)', 'home payback, years', 'producer payback, years', 'jobs ×'])); console.log('|---|---:|---:|---:|---:|---:|---:|');
  ERAS.forEach((e, i) => console.log(line([e.id, SCALE.M[i], SCALE.cpc[i].toFixed(1), SCALE.taxMult[i], SCALE.homePaybackYears[i], SCALE.prodPaybackYears[i], SCALE.JM[i]])));
  console.log('\n## Discoveries (28)\n');
  console.log(line(['era', 'id', 'name', 'cost', 'time (game s ÷ research speed)', 'effect', 'unlocks'])); console.log('|---|---|---|---:|---:|---|---|');
  for (const d of DISC) console.log(line([ERAS[d.era].id, d.id, `${d.ru} (${d.en})`, fmt(d.cost), d.time, Object.entries(d.eff).map(([k, v]) => k + (v < 1 ? ' +' + Math.round(v * 100) + '%' : ' +' + v)).join(', ') || '—', d.unlocks.join(', ') || '—']));
  console.log('\n## Era gates (Town Hall upgrades)\n');
  console.log(line(['enter', 'Town Hall level', 'population', 'signature items', 'discoveries', 'cost (money + materials)', 'build time', 'density path'])); console.log('|---|---|---:|---|---|---:|---:|---|');
  console.log(line(['(mid-Antiquity)', `L2 ${lvl('town_center', 2).ru}`, TC2_POP, '—', '—', `${fmt(lvl('town_center', 2).money)} + ${fmt(lvl('town_center', 2).matCost)}`, `${lvl('town_center', 2).time / SPY} yr`, '—']));
  for (let e = 1; e <= 6; e++) { const g = GATES[e], l = lvl('town_center', e + 2); console.log(line([ERAS[e].en, `L${e + 2} ${l.ru}`, fmt(g.pop), g.items.map(i => i.ru).join(' · '), `3 of 4 (${ERAS[e - 1].en})`, `${fmt(l.money)} + ${fmt(l.matCost)}`, `${l.time / SPY} yr`, g.density])); }
  console.log('\n## Expansion strips\n');
  console.log(line(['# bought', 'price', 'left strip (deposit)', 'right strip (deposit)'])); console.log('|---:|---:|---|---|');
  const dep = d => Object.entries(d).filter(([k]) => k !== 'rich').map(([k, v]) => `${k}${v > 1 ? ' ×' + v : ''}${d.rich === k ? ' (rich ×1.5)' : ''}`).join(', ');
  for (let k = 0; k < STRIPS.count; k++) { const i = Math.floor(k / 2); console.log(line([k + 1, fmt(STRIPS.price[k]), k % 2 === 0 ? `L${i + 1} x ${30 - 5 * i}–${34 - 5 * i}: ${dep(STRIPS.left[i])}` : '', k % 2 === 1 ? `R${i + 1} x ${65 + 5 * i}–${69 + 5 * i}: ${dep(STRIPS.right[i])}` : ''])); }
  console.log('\n## Roads (per tile)\n');
  console.log(line(['family', 'id', 'era', 'name', 'cost money + mat', 'capacity (trips/tile)', 'upkeep/yr', 'happiness next to it', 'transit share'])); console.log('|---|---|---|---|---:|---:|---:|---:|---:|');
  for (const k of ['street', 'avenue']) ROADS[k].forEach(r => console.log(line([k, r.id, ERAS[r.era].id, `${r.ru} (${r.en})${r.retrofit ? ' — retrofit of ' + r.retrofit : ''}`, `${fmt(r.money)} + ${fmt(r.matCost)}`, r.cap, r.upkeep, (r.appeal >= 0 ? '+' : '') + r.appeal, r.transit ? Math.round(r.transit * 100) + ' %' : '—'])));
  console.log('\n## Building roster (generated)\n');
  for (const b of Object.values(B)) {
    console.log(`\n#### ${b.id} — ${b.ru} (${b.en}) · ${b.cat} · jobs class ${b.cls} · ${b.size[0]}×${b.size[1]} · ${b.place}${b.unique ? ' · unique' : ''}${b.service ? ' · covers ' + b.service : ''}${b.deposit ? ' · needs ' + b.deposit + ' deposit' : ''}${b.rotatable ? ' · rotatable' : ''}\n`);
    console.log(line(['L', 'era', 'name', 'cost (money + mat)', 'build', 'upkeep/yr', 'effects (per year)', 'v2 model']));
    console.log('|---|---|---|---:|---:|---:|---|---|');
    for (const l of b.levels) {
      const e = [];
      if (l.housing) e.push(`housing ${l.housing}${b.villa ? ' (tax ×3)' : ''}`);
      if (l.tier !== undefined && l.tier > 0) e.push(`needs: ${NEEDS.slice(0, l.tier).map(n => NEED_RU[n]).join(', ')}`);
      if (l.jobs) e.push(`jobs ${l.jobs}`);
      if (l.food) e.push(`food +${fmt(l.food)}`);
      if (l.mat) e.push(`materials +${fmt(l.mat)}${b.deposit ? ' (×1.5 on a rich deposit)' : ''}`);
      if (l.goods) e.push(`goods +${fmt(l.goods)}`);
      if (l.fuel) e.push(`fuel +${fmt(l.fuel)}`);
      if (l.input) e.push(`uses ${l.input} ${fmt(l.inputUse)}`);
      if (l.fuelUse) e.push(`uses fuel ${l.fuelUse}`);
      if (l.trade) e.push(`trade capacity ${fmt(l.trade)}${b.id === 'port' ? ' (×1.5 in the deep bay)' : ''}`);
      if (l.storage) e.push(`storage ${fmt(l.storage)}`);
      if (l.r && b.service) e.push(`${b.service} r${l.r}`);
      if (l.r && b.id === 'district_hall') e.push(`charter r${l.r}`);
      if (l.r && b.id === 'data_center') e.push(`data r${l.r}, homes in range tax +${Math.round(l.dataTax * 100)}%`);
      if (l.transit) e.push(`metro r${l.r}: car trips −${Math.round(l.transit * 100)}%, happiness +${l.appeal}`);
      if (l.research) e.push(`research +${Math.round(l.research * 100)}%`);
      if (l.attraction) e.push(`attraction ${l.attraction}`);
      if (l.visitors) e.push(`visitor capacity ${fmt(l.visitors)}`);
      if (l.importDisc) e.push(`import prices −${Math.round(l.importDisc * 100)}%`);
      if (l.goodsPremium) e.push(`goods price +${Math.round(l.goodsPremium * 100)}%`);
      if (l.aura) e.push(`happiness ${l.aura[1] > 0 ? '+' : ''}${l.aura[1]} r${l.aura[0]}`);
      if (l.power) e.push(`power +${l.power}`);
      if (l.pu) e.push(`uses ${l.pu} power`);
      if (l.pollution) e.push(`pollution ${l.pollution[1]} r${l.pollution[0]}`);
      if (l.farmBoost) e.push('farms +25% r3');
      const u = UNLOCKED_BY[`${b.id}:${l.level}`]; if (u) e.push(`discovery: ${DISC_BY_ID[u].en}`);
      if (l.tc) e.push(`Town Hall L${l.tc}`);
      console.log(line([l.level, ERAS[l.era].id, l.ru, `${fmt(l.money)} + ${fmt(l.matCost)}`, `${(l.time / SPY).toFixed(1)} yr`, fmt(l.upkeep), e.join(', '), l.reuse === 'NEW' ? '**NEW**' : l.reuse]));
    }
  }
  let nb = 0, nl = 0, reused = 0; for (const b of Object.values(B)) { nb++; nl += b.levels.length; reused += b.levels.filter(l => l.reuse !== 'NEW').length; }
  console.log(`\nTotals: ${nb} buildings, ${nl} levels (${reused} reuse a v2 model, ${nl - reused} NEW), plus ${ROADS.street.length + ROADS.avenue.length} road levels and ${TRACK.length} track levels.`);
}

// run last, after every module-level constant (VISITORS0 …) is initialised
if (isMain) main();
