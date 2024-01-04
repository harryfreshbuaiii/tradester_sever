const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const {
  getUserId,
  connectMongoose,
  internalError,
  error500,
} = require("../utils.js/util");
function authenticateToken(req, res, next) {
  const token = req.headers["access-token"];
  if (!token) {
    return res.status(401).send("Unauthorized access");
  }

  jwt.verify(token, process.env.JWT_SECRET, (error, decode) => {
    if (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).send("Session expired. Login to continue");
      } else {
        return res.status(403).send("Forbidden access");
      }
    } else {
      req.userId = decode;
      next();
    }
  });
}
async function isAdminAuth(req, res, next) {
  const _id = getUserId(req.userId.userId);
  const collection = connectMongoose("users");
  try {
    const findUser = await collection.findOne({ _id });
    if (!findUser.isAdmin) {
      return res.status(403).send("Forbidden access");
    }
    next();
  } catch (error) {
    internalError(res, 500, error500);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + file.originalname);
  },
});

const upload = multer({ storage: storage });

module.exports = { authenticateToken, upload, isAdminAuth };
