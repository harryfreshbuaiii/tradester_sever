const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { AvatarGenerator } = require("random-avatar-generator");
const generator = new AvatarGenerator();
const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const puppeteer = require("puppeteer");
const fs = require("fs");
const ejs = require("ejs");
const cron = require("node-cron");
const { getExternal, getNewsExternal } = require("../api/controllers");
const TelegramBot = require("node-telegram-bot-api");


const saltRounds = 10;
function generateJWT(params) {
  const expirationTime = 30 * 24 * 60 * 60;
  const token = jwt.sign({ userId: params }, process.env.JWT_SECRET, {
    expiresIn: expirationTime,
  });
  return token;
}
function generateSixDigitCode() {
  const min = 100000;
  const max = 999999;
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  return code;
}
function generateHexToken(length) {
  const randomBuffer = crypto.randomBytes(length);
  return randomBuffer.toString("hex");
}
async function sendEmail(
  email,
  subject,
  successFn = () => {},
  errorFn = () => {},
  template,
  contentData
) {
  const collection = connectMongoose("site");
  const collectionUser = connectMongoose("users");
  const _id = getUserId(process.env.SITE_ID);
  const url = process.env.MY_DOMAIN_ASSETS;

  try {
    const transporter = nodemailer.createTransport({
      service: process.env.HOSTNAME,
      port: 465, // SMTP port (465 for SSL)
  secure: true, // Use SSL/TLS
      auth: {
        user: process.env.USERNAME,
        pass: process.env.APP_PASSWORD,
      },
    });
    const findLogo = await collection.findOne({ _id });
    const findUsername = await collectionUser.findOne({ email });
    const generatedContentHtml = await generateEmailContent(
      contentData,
      "./views/" + template + ".ejs"
    );
    const social_icons = [
      {
        name: "facebook",
        svg: url + "facebook.svg",
        url: null,
      },
      {
        name: "whatsapp",
        svg: url + "whatsapp.svg",
        url: "https://wa.me/" + findLogo.phone,
      },
      {
        name: "tiktok",
        svg: url + "tiktok.svg",
        url: null,
      },
      {
        name: "telegram",
        svg: url + "telegram.svg",
        url: "https://t.me/" + findLogo.telegram,
      },
    ];
    const data = {
      logo: url + findLogo.logo,
      icon: social_icons,
      site: findLogo.site,
      site_address: findLogo.site_address,
      address: findLogo.address,
      app_name: findLogo.app_name,
      sender: undefined,
      username: findUsername?.name,
      content: generatedContentHtml,
    };
    const emailTemplate = fs.readFileSync("./views/index.ejs", "utf8");
    const renderedHtml = ejs.render(emailTemplate, data);
    const mailOptions = {
      from: process.env.USERNAME,
      to: email,
      subject: subject,
      html: renderedHtml,
    };
    await transporter.sendMail(mailOptions);

    successFn();
  } catch (error) {
    errorFn();
    return;
  }
}

function connectMongoose(collection) {
  return mongoose.connection.collection(collection);
}
function generatePic(params) {
  return generator.generateRandomAvatar();
}
function formattedDate(params) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}
const error500 = "System error. Try again later";
async function hashPassword(password) {
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
  } catch (err) {
    return null;
  }
}
function comparePassword(password, dbPassword, successFn, errorFn) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, dbPassword, (err, result) => {
      if (err) {
        // Handle error (e.g., log, reject the promise)
        console.error("Error comparing passwords:", err);
        reject(err);
        return;
      }

      if (result) {
        resolve();
        successFn();
      } else {
        reject();
        errorFn();
      }
    });
  });
}

function feedbackMessages(type, message) {
  const result = { type, message };
  return result;
}
async function sendVerificationLink(
  res,
  email,
  collection,
  sendResFn,
  link,
  token,
  oldEmail
) {
  const subject = link?.isForgotPassword
    ? "Forgot Password?"
    : "Verify Your Email To Start Earning!!!";
  const template = link?.isForgotPassword ? "forgotPassword" : "verify_email";
  const msg = link;
  async function successFn(params) {
    await collection.findOneAndUpdate(
      { email: oldEmail ? oldEmail : email },
      {
        $set: {
          token,
        },
      },
      { upsert: true, new: true }
    );
    setTimeout(async () => {
      await collection.findOneAndUpdate(
        { email: oldEmail ? oldEmail : email },
        {
          $unset: {
            token: 1,
          },
        }
      );
    }, 1000 * 60 * 5);
    sendResFn();
  }
  sendEmail(
    email,
    subject,
    () => successFn(),
    () => res.status(500).send(feedbackMessages("error", error500)),
    template,
    msg
  );
}
function internalError(res, status, msg) {
  res.status(status).send(feedbackMessages("error", msg));
}
function resSendSuccess(res, msg, data) {
  res.status(200).send({ ...feedbackMessages("success", msg), data });
}
function getUserId(userId) {
  return new ObjectId(userId);
}
function truncateEmail(email) {
  const atIndex = email.indexOf("@");
  if (atIndex > 6) {
    const username = email.substring(0, 2);
    const domain = email.substring(atIndex - 1);
    return `${username}...${domain}`;
  }
  return email;
}
function excludeItems(obj, excludeList) {
  const result = {};
  for (const key in obj) {
    if (!excludeList.includes(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}
function generateRandomAlphanumericCode(length) {
  const alphanumericChars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * alphanumericChars.length);
    code += alphanumericChars[randomIndex];
  }
  return code;
}
function arraySum(params) {
  return params.reduce((accumulator, currentValue) => {
    return accumulator + parseInt(currentValue);
  }, 0);
}
function calculateValueAndPercentage(value, percentage) {
  const numericValue = parseFloat(value);
  const numericPercentage = parseFloat(percentage.replace("%", ""));

  if (isNaN(numericValue) || isNaN(numericPercentage)) {
    return 0;
  }

  const calculatedPercentage = numericValue * (numericPercentage / 100);
  const total = numericValue + calculatedPercentage;

  return {
    profit: total.toFixed(2),
    addedValue: calculatedPercentage.toFixed(2),
  };
}

async function addUsersProfit(userId, id, getPlan, amount, profit, refProfit) {
  const userCollection = connectMongoose("users");
  const investmentCollection = connectMongoose("investment");
  try {
    const user = await userCollection.findOne({ _id: userId });

    await userCollection.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          balance: String((Number(user.balance) + Number(profit)).toFixed(2)),
        },
      }
    );
    await investmentCollection.findOneAndUpdate(
      { id },
      {
        $set: {
          status: "completed",
          refEarning: refProfit,
        },
      }
    );
    const msg = `<p>We are thrilled to inform you about the success of your investment with us.</p>
    <ul style="list-style: none; padding-left: 0;">
    <li><strong>Plan Name:</strong> ${getPlan.name}</li>
    <li><strong>Amount Deposited:</strong> ${amount} USD</li>
    <li><strong>Profit Earned:</strong>${profit} USD</li>
  </ul>
  <p>Your commitment and trust in our platform have led to this fruitful outcome. We deeply appreciate your belief in our investment plans and services.</p>`;
    const subject = `Congratulations on Your Successful Investment!`;
    await sendEmail(
      user.email,
      subject,
      async () => {
        await addNotification(subject, msg, user.email);
      },
      () => {},
      "plan",
      { profit, amount, plan: getPlan.name }
    );
    if (user.referral) {
      const refProfit = calculateValueAndPercentage(amount, getPlan.commission);
      const refDetails = await userCollection.findOne({
        my_ref_id: user.referral,
      });
      await userCollection.findOneAndUpdate(
        { email: refDetails.email },
        {
          $set: {
            balance: String(
              (
                Number(refDetails.balance) + Number(refProfit.addedValue)
              ).toFixed(2)
            ),
          },
        }
      );
      const subject = `${refProfit.addedValue} USD Referral Profit!`;
      const msg = `<ul style="list-style: none; padding-left: 0">
      <li><strong>Referral Bonus Amount:</strong>${refProfit.addedValue} USD</li>
      <li><strong>From User:</strong>${user.name} USD</li>
      <li><strong>Plan:</strong>${getPlan.name} Plan</li>
    </ul>
  
    <p>
      Your efforts in referring others to our platform have been fruitful, and we
      sincerely appreciate your contribution to our community.
    </p>`;
      await sendEmail(
        refDetails.email,
        subject,
        async () => {
          await addNotification(subject, msg, refDetails.email);
        },
        () => {},
        "referral",
        { profit: refProfit.addedValue, user: user.name, plan: getPlan.name }
      );
    }
  } catch (error) {}
}
async function fetchExternalData(url, cookies) {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36"
    );
    cookies && (await page.setCookie(...cookies));
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // const htmlContent = await page.content(); // Get the HTML content

    const jsonResponse = await page.evaluate(() => {
      const preElement = document.querySelector("pre");
      if (preElement) {
        return JSON.parse(preElement.textContent);
      } else {
        return { error: "JSON data not found on the page." };
      }
    });

    await browser.close();
    return jsonResponse;
  } catch (error) {
    console.log({ error });
  }
}
function sortByDateTime(arr) {
  return arr.sort((a, b) => {
    const dateA = new Date(a.date + "T" + a.time);
    const dateB = new Date(b.date + "T" + b.time);
    return dateB - dateA;
  });
}
async function isAdmn(_id, res) {
  const collection = connectMongoose("users");
  const data = await collection.findOne({ _id });
  if (!data.isAdmin) {
    internalError(res, 401, "Unauthorized access");
  }
  return data.isAdmin;
}
async function deleteFile(
  collection,
  _id,
  files,
  pFunction = () => {},
  res,
  successMsg,
  isEmptyVideo
) {
  function removeFIle(item) {
    const filePath = `uploads/${getImage[item].substring(
      getImage[item].lastIndexOf("/") + 1
    )}`;
    if (!fs.existsSync(filePath)) {
      pFunction();
      return;
    }
    fs.unlink(filePath, async (error) => {
      if (!error) {
        pFunction();
        return;
      }
      return;
    });
  }
  const getImage = await collection.findOne({ _id });
  if (files.length > 0) {
    files.map((item) => {
      if (getImage && getImage[item]) {
        removeFIle(item);
      }
    });
  }
  if (isEmptyVideo) {
    removeFIle("video");
    return;
  }
  pFunction();
  resSendSuccess(res, successMsg);
}
function sanitizeUndefinedValues(data) {
  if (data === "null" || data === "undefined") {
    return null;
  }
  return data;
}
async function paginateArray(req, collection) {
  const PAGE_SIZE = 10;
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const totalItems = await collection.countDocuments();
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const hasMore = page < totalPages;
  const data = await collection
    .find()
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray();
  const metadata = {
    currentPage: page,
    totalPages: totalPages,
    totalItems: totalItems,
    hasMore: hasMore,
  };
  return { metadata, data };
}
async function paginateArrayDateTime(req, collection) {
  const PAGE_SIZE = 10;
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const totalItems = await collection.countDocuments();
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const hasMore = page < totalPages;
  const data = await collection
    .aggregate([
      {
        $addFields: {
          combinedDateTime: {
            $dateFromString: {
              dateString: {
                $concat: ["$date", "T", "$time"],
              },
              format: "%Y-%m-%dT%H:%M:%S",
            },
          },
        },
      },
      {
        $sort: {
          combinedDateTime: -1, // Sort in descending order (most recent first)
        },
      },
      {
        $skip: (page - 1) * PAGE_SIZE, // Skip based on the page number
      },
      {
        $limit: PAGE_SIZE, // Limit the number of results per page
      },
    ])
    .toArray();
  const metadata = {
    currentPage: page,
    totalPages: totalPages,
    totalItems: totalItems,
    hasMore: hasMore,
  };
  return { metadata, data };
}
async function addNotification(subject, message, email, sender) {
  const collection = connectMongoose("notification");

  const data = {
    sender: sender || "system",
    subject,
    message,
    email,
    read: false,
    date: formattedDate(),
    time: getCurrentTime(),
  };
  await collection.insertOne(data);
}
async function paginatePage(filter = {}, req, collection) {
  const PAGE_SIZE = 10;
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const totalItems = await collection.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const hasMore = page < totalPages;
  const data = await collection.find(filter).toArray();
  const sortedData = data.sort((a, b) => {
    const combinedDateTimeA = new Date(`${a.date}T${a.time}`);
    const combinedDateTimeB = new Date(`${b.date}T${b.time}`);
    return combinedDateTimeB - combinedDateTimeA; // Sort in descending order
  });
  const paginatedData = sortedData.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const metadata = {
    currentPage: page,
    totalPages: totalPages,
    totalItems: totalItems,
    hasMore: hasMore,
  };
  return { metadata, data: paginatedData };
}
function getBaseUrl(req) {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return baseUrl;
}
async function generateEmailContent(contentData, emailTemplatePath) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      emailTemplatePath,
      { data: contentData },
      (err, renderedHtml) => {
        if (err) {
          console.error("EJS render error:", err);
          reject(err);
        } else {
          resolve(renderedHtml);
        }
      }
    );
  });
}
function capitalizeFirstLetter(str) {
  const [firstLetter, ...rest] = str;
  return `${firstLetter.toUpperCase()}${rest.join("")}`;
}
function getTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone;
}

function updateRate(params) {
  const serverTimeZone = getTimeZone();

  const currentCronJob = cron.schedule(
    "0 6 * * *",
    () => {
      getExternal();
      currentCronJob.destroy();
    },
    {
      scheduled: true,
      timezone: serverTimeZone,
      runOnInit: true,
    }
  );
}
function updateNews(params) {
  const serverTimeZone = getTimeZone();

  const currentCronJob = cron.schedule(
    "0 0 * * 1",
    () => {
      getNewsExternal();
      currentCronJob.destroy();
    },
    {
      scheduled: true,
      timezone: serverTimeZone,
      runOnInit: true,
    }
  );
}
async function sendTGMsg(params) {
  const token = process.env.TOKEN;
  const bot = new TelegramBot(token, { polling: true });
  await bot.sendMessage(process.env.CHAT_ID, params);
}
module.exports = {
  sendTGMsg,
  updateNews,
  updateRate,
  capitalizeFirstLetter,
  generateEmailContent,
  getBaseUrl,
  paginateArray,
  sanitizeUndefinedValues,
  deleteFile,
  isAdmn,
  sortByDateTime,
  fetchExternalData,
  generateJWT,
  generateSixDigitCode,
  generateHexToken,
  sendEmail,
  connectMongoose,
  generatePic,
  formattedDate,
  getCurrentTime,
  error500,
  hashPassword,
  comparePassword,
  feedbackMessages,
  sendVerificationLink,
  internalError,
  resSendSuccess,
  getUserId,
  truncateEmail,
  excludeItems,
  generateRandomAlphanumericCode,
  arraySum,
  calculateValueAndPercentage,
  addUsersProfit,
  paginateArrayDateTime,
  addNotification,
  paginatePage,
};
