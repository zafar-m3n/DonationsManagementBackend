const fs = require("fs");
const multer = require("multer");

const createUploadDir = (uploadDir) => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
};

const getMulterUpload = (uploadDir) => {
  createUploadDir(uploadDir);

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  });

  return multer({ storage });
};

module.exports = { getMulterUpload };
