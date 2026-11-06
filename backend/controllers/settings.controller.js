import Setting from '../models/Setting.model.js';

/** Company fields (printed on PDFs) accepted by updateSettings, with their max length. */
const COMPANY_FIELDS = {
  companyName: 120,
  companyAddress: 250,
  companyPhone: 80,
  companyEmail: 120,
  companyTaxId: 60,
  companyLogo: 250,
};
const LOGO_PATH = /^\/uploads\/settings\/[\w.-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate the company fields present in the body.
 * @returns {{ values: object, error: string|null }}
 */
const readCompanyFields = (body) => {
  const values = {};
  for (const [field, maxLength] of Object.entries(COMPANY_FIELDS)) {
    if (body[field] === undefined) continue;
    if (body[field] !== null && typeof body[field] !== 'string') {
      return { values, error: `قيمة غير صالحة للحقل ${field}` };
    }
    const value = (body[field] || '').trim();
    if (value.length > maxLength) {
      return { values, error: `الحقل ${field} طويل جداً (الحد الأقصى ${maxLength} حرفاً)` };
    }
    values[field] = value;
  }
  if (values.companyEmail && !EMAIL.test(values.companyEmail)) {
    return { values, error: 'البريد الإلكتروني للشركة غير صالح' };
  }
  if (values.companyLogo && !LOGO_PATH.test(values.companyLogo)) {
    return { values, error: 'مسار شعار الشركة غير صالح' };
  }
  return { values, error: null };
};

export const getSettings = async (req, res, next) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
        vat: 19,
        deliveryFee: 10,
        storeOpen: true,
      });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const { vat, deliveryFee, storeOpen } = req.body;
    const { values: companyValues, error } = readCompanyFields(req.body || {});
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create({
        vat: vat || 19,
        deliveryFee: deliveryFee || 10,
        storeOpen: storeOpen !== undefined ? storeOpen : true,
        ...companyValues,
      });
    } else {
      if (vat !== undefined) settings.vat = vat;
      if (deliveryFee !== undefined) settings.deliveryFee = deliveryFee;
      if (storeOpen !== undefined) settings.storeOpen = storeOpen;
      Object.assign(settings, companyValues);
      await settings.save();
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};
