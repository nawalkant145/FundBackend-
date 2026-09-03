const FundingImpact = require("./funding.model");
const ApiError = require("../../utils/ApiError");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

class FundingService {
  async getImpactSummary() {
    let records = await FundingImpact.find()
      .sort({ year: 1, month: 1 })
      .populate("updatedBy", "name username role");

    if (!records || records.length === 0) {
      const defaultRecords = [
        { month: 3, year: 2026, fundingAmountCr: 9, startupsFunded: 5 },
        { month: 4, year: 2026, fundingAmountCr: 12, startupsFunded: 8 },
        { month: 5, year: 2026, fundingAmountCr: 10, startupsFunded: 6 },
        { month: 6, year: 2026, fundingAmountCr: 15, startupsFunded: 11 },
        { month: 7, year: 2026, fundingAmountCr: 15.2, startupsFunded: 10 },
        { month: 8, year: 2026, fundingAmountCr: 18.5, startupsFunded: 12 },
      ];
      try {
        await FundingImpact.insertMany(defaultRecords);
        records = await FundingImpact.find()
          .sort({ year: 1, month: 1 })
          .populate("updatedBy", "name username role");
      } catch (err) {
        console.error("Auto-seed funding records error:", err);
      }
    }

    if (!records || records.length === 0) {
      return {
        currentMonth: null,
        previousMonth: null,
        monthOverMonthGrowth: 0,
        totalFundingCr: 0,
        totalStartupsFunded: 0,
        trend: [],
        lastUpdated: null,
      };
    }

    const totalFundingCr = Number(
      records.reduce((sum, r) => sum + (r.fundingAmountCr || 0), 0).toFixed(2)
    );

    const totalStartupsFunded = records.reduce(
      (sum, r) => sum + (r.startupsFunded || 0),
      0
    );

    const currentMonthRecord = records[records.length - 1];
    const previousMonthRecord = records.length > 1 ? records[records.length - 2] : null;

    const currFunding = currentMonthRecord ? currentMonthRecord.fundingAmountCr : 0;
    const prevFunding = previousMonthRecord ? previousMonthRecord.fundingAmountCr : 0;

    let monthOverMonthGrowth = 0;
    if (prevFunding > 0) {
      monthOverMonthGrowth = Number((((currFunding - prevFunding) / prevFunding) * 100).toFixed(2));
    }

                                          
    const lastUpdated = records.reduce((latest, r) => {
      const ts = new Date(r.updatedAt || r.createdAt).getTime();
      return ts > latest ? ts : latest;
    }, 0);

    const trend = records.map((r) => ({
      _id: r._id,
      month: r.month,
      monthName: MONTH_NAMES[r.month - 1],
      year: r.year,
      fundingAmountCr: r.fundingAmountCr,
      startupsFunded: r.startupsFunded,
      updatedAt: r.updatedAt,
    }));

    return {
      currentMonth: currentMonthRecord
        ? {
            _id: currentMonthRecord._id,
            month: currentMonthRecord.month,
            monthName: MONTH_NAMES[currentMonthRecord.month - 1],
            year: currentMonthRecord.year,
            fundingAmountCr: currentMonthRecord.fundingAmountCr,
            startupsFunded: currentMonthRecord.startupsFunded,
          }
        : null,
      previousMonth: previousMonthRecord
        ? {
            _id: previousMonthRecord._id,
            month: previousMonthRecord.month,
            monthName: MONTH_NAMES[previousMonthRecord.month - 1],
            year: previousMonthRecord.year,
            fundingAmountCr: previousMonthRecord.fundingAmountCr,
            startupsFunded: previousMonthRecord.startupsFunded,
          }
        : null,
      monthOverMonthGrowth,
      totalFundingCr,
      totalStartupsFunded,
      trend,
      lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
    };
  }

  async listAllRecords() {
    const records = await FundingImpact.find()
      .sort({ year: -1, month: -1 })
      .populate("updatedBy", "name username role email");

    return records.map((r) => ({
      _id: r._id,
      month: r.month,
      monthName: MONTH_NAMES[r.month - 1],
      year: r.year,
      fundingAmountCr: r.fundingAmountCr,
      startupsFunded: r.startupsFunded,
      updatedBy: r.updatedBy
        ? {
            _id: r.updatedBy._id,
            name: r.updatedBy.name,
            username: r.updatedBy.username,
            role: r.updatedBy.role,
          }
        : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async createMonthlyFunding(data, userId) {
    const { month, year, fundingAmountCr, startupsFunded } = data;

    if (!month || month < 1 || month > 12) {
      throw new ApiError(400, "Month must be between 1 and 12");
    }
    if (!year || year < 2000 || year > 2100) {
      throw new ApiError(400, "Year must be a valid 4-digit year");
    }
    if (fundingAmountCr === undefined || fundingAmountCr === null || Number(fundingAmountCr) < 0) {
      throw new ApiError(400, "Funding amount must be a positive number or 0");
    }
    if (startupsFunded === undefined || startupsFunded === null || !Number.isInteger(Number(startupsFunded)) || Number(startupsFunded) < 0) {
      throw new ApiError(400, "Startups funded must be a non-negative integer");
    }

    const existing = await FundingImpact.findOne({ month: Number(month), year: Number(year) });
    if (existing) {
      throw new ApiError(400, `Funding record already exists for ${MONTH_NAMES[month - 1]} ${year}`);
    }

    const record = await FundingImpact.create({
      month: Number(month),
      year: Number(year),
      fundingAmountCr: Number(fundingAmountCr),
      startupsFunded: Number(startupsFunded),
      updatedBy: userId,
    });

    return record;
  }

  async updateMonthlyFunding(id, data, userId) {
    const record = await FundingImpact.findById(id);
    if (!record) {
      throw new ApiError(404, "Funding record not found");
    }

    const { month, year, fundingAmountCr, startupsFunded } = data;

    if (month !== undefined) {
      if (month < 1 || month > 12) throw new ApiError(400, "Month must be between 1 and 12");
      record.month = Number(month);
    }
    if (year !== undefined) {
      if (year < 2000 || year > 2100) throw new ApiError(400, "Year must be a valid 4-digit year");
      record.year = Number(year);
    }
    if (fundingAmountCr !== undefined) {
      if (Number(fundingAmountCr) < 0) throw new ApiError(400, "Funding amount must be >= 0");
      record.fundingAmountCr = Number(fundingAmountCr);
    }
    if (startupsFunded !== undefined) {
      if (!Number.isInteger(Number(startupsFunded)) || Number(startupsFunded) < 0) {
        throw new ApiError(400, "Startups funded must be an integer >= 0");
      }
      record.startupsFunded = Number(startupsFunded);
    }

                                                     
    const conflict = await FundingImpact.findOne({
      _id: { $ne: id },
      month: record.month,
      year: record.year,
    });
    if (conflict) {
      throw new ApiError(400, `A funding record for ${MONTH_NAMES[record.month - 1]} ${record.year} already exists.`);
    }

    record.updatedBy = userId;
    await record.save();
    return record;
  }

  async deleteMonthlyFunding(id) {
    const record = await FundingImpact.findByIdAndDelete(id);
    if (!record) {
      throw new ApiError(404, "Funding record not found");
    }
    return record;
  }
}

module.exports = new FundingService();
