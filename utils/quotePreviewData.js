const Project = require('../models/Project');
const WindowItem = require('../models/WindowItem');
const User = require('../models/User');
const WindowSystem = require('../models/Window');

/**
 * Same window items + quoted totals as /projects/:id/quote-preview (per-line markup applied).
 */
async function getQuotePreviewLocals(projectId, userId) {
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) {
    return null;
  }

  const windowItems = await WindowItem.find({ projectId }).sort({ createdAt: -1 });

  const windowItemsWithConfig = await Promise.all(
    windowItems.map(async (item) => {
      let windowSystem = null;
      if (item.style) {
        windowSystem = await WindowSystem.findOne({ type: item.style })
          .populate('profiles.profile')
          .populate('accessories.accessory')
          .lean();
      }

      if (!windowSystem && item.description) {
        const match = item.description.match(/Window System: ([^\n]+)/);
        if (match) {
          const systemType = match[1].trim();
          windowSystem = await WindowSystem.findOne({ type: systemType })
            .populate('profiles.profile')
            .populate('accessories.accessory')
            .lean();
        }
      }

      const plain = {
        ...item.toObject(),
        windowSystem
      };
      const m =
        plain.markup !== undefined && plain.markup !== null && !Number.isNaN(Number(plain.markup))
          ? Number(plain.markup)
          : 20;
      const baseU = Number(plain.unitPrice) || 0;
      const baseT = Number(plain.totalPrice) || 0;
      plain._markupPct = m;
      plain._quotedUnit = baseU * (1 + m / 100);
      plain._quotedLineTotal = baseT * (1 + m / 100);
      return plain;
    })
  );

  const projectTotal = windowItems.reduce((total, item) => total + item.totalPrice, 0);
  const quotedProjectTotal = windowItemsWithConfig.reduce((sum, i) => sum + (i._quotedLineTotal || 0), 0);

  const quoteExchangeRate =
    project.frozenExchangeRate != null && Number(project.frozenExchangeRate) > 0
      ? Number(project.frozenExchangeRate)
      : await getExchangeRate();
  const quotedTotalUsd = Number(quotedProjectTotal) || 0;
  const quotedTotalCop = Math.round(quotedTotalUsd * quoteExchangeRate);
  const quotedProjectTotalCOPFormatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(quotedTotalCop);

  const user = await User.findById(userId).lean();
  const companyLogo = user?.companyLogo || null;

  return {
    project,
    windowItems: windowItemsWithConfig,
    projectTotal: projectTotal.toFixed(2),
    quotedProjectTotal: quotedProjectTotal.toFixed(2),
    companyLogo
  };
}

module.exports = { getQuotePreviewLocals };
