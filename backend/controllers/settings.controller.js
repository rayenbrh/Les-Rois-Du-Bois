import Setting from '../models/Setting.model.js';

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
    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create({
        vat: vat || 19,
        deliveryFee: deliveryFee || 10,
        storeOpen: storeOpen !== undefined ? storeOpen : true,
      });
    } else {
      if (vat !== undefined) settings.vat = vat;
      if (deliveryFee !== undefined) settings.deliveryFee = deliveryFee;
      if (storeOpen !== undefined) settings.storeOpen = storeOpen;
      await settings.save();
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

