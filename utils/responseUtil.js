const resSuccess = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({ code: "OK", data });
};

const resError = (res, error, statusCode = 500) => {
  return res.status(statusCode).json({ code: "ERROR", error });
};

module.exports = {
  resSuccess,
  resError,
};
