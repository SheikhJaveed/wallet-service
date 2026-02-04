const Joi = require('joi');

exports.topup = Joi.object({
  amount: Joi.number().integer().positive().required(),
  asset_type_id: Joi.number().integer().required(),
  payment_id: Joi.string().required()
});

exports.spend = Joi.object({
  amount: Joi.number().integer().positive().required(),
  asset_type_id: Joi.number().integer().required()
});
