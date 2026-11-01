const service = require('../services/restockAlerts');
const requestAlert = (req, res, next) => {
  try {
    const input = service.normalizeRequest(req.body);
    res.status(202).json({
      success: true,
      message:
        'Si la solicitud es válida, recibirás un correo para confirmar el aviso. Revisa también spam.',
    });
    void service.requestAlert(input).catch((error) =>
      require('../config/logger').error('No se pudo preparar el aviso solicitado.', {
        errorCode: error.code || error.name,
      }),
    );
  } catch (error) {
    next(error);
  }
};
const preference = (action) => async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    await service[action](req.body?.token);
    res.json({
      success: true,
      message:
        action === 'confirmAlert'
          ? 'Aviso confirmado. Te escribiremos si vuelve a haber disponibilidad.'
          : 'Tu solicitud de baja se procesó. Un correo cuyo envío ya comenzó podría llegar.',
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  requestAlert,
  confirm: preference('confirmAlert'),
  unsubscribe: preference('unsubscribeAlert'),
};
