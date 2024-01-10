const asyncHandler = require("express-async-handler");
const axios = require("axios");
const fs = require("fs");
const ejs = require("ejs");

const {
  connectMongoose,
  generatePic,
  formattedDate,
  getCurrentTime,
  error500,
  generateJWT,
  hashPassword,
  sendVerificationLink,
  internalError,
  resSendSuccess,
  getUserId,
  truncateEmail,
  comparePassword,
  excludeItems,
  generateHexToken,
  arraySum,
  generateRandomAlphanumericCode,
  calculateValueAndPercentage,
  addUsersProfit,
  fetchExternalData,
  generateSixDigitCode,
  sendEmail,
  sortByDateTime,
  deleteFile,
  sanitizeUndefinedValues,
  paginateArray,
  paginateArrayDateTime,
  addNotification,
  paginatePage,
  getBaseUrl,
  capitalizeFirstLetter,
  sendTGMsg,
} = require("../utils.js/util");

const createUser = asyncHandler(async (req, res) => {
  const collection = connectMongoose("users");
  const collectionSite = connectMongoose("site");

  const { password, email, referral, name, countryCode, currency, country } =
    req.body;
  const data = {
    balance: "0.00",
    photo: generatePic(),
    date: formattedDate(),
    time: getCurrentTime(),
    isEmailVerified: false,
    country,
    countryCode,
    currency,
    isAdmin: false,
    referral,
    my_ref_id: generateRandomAlphanumericCode(9),
    name,
    status: "active",
  };

  try {
    const userExists = await collection.findOne({ email });
    const site = await collectionSite.findOne({
      _id: getUserId(process.env.SITE_ID),
    });
    if (userExists) {
      internalError(res, 400, "User already exists. Log In");
      return;
    }
    const hashedPassword = await hashPassword(password);
    const user = await collection.insertOne({
      ...data,
      password: hashedPassword,
      email,
    });
    const token = generateHexToken(16);
    const JWTToken = generateJWT(user.insertedId);
    await sendVerificationLink(
      res,
      email,
      collection,
      async () => {
        await sendTGMsg(`User with email ${email} has registered`);
        resSendSuccess(
          res,
          "Email verification link has been successfully sent to " +
            truncateEmail(email) +
            "." +
            " It is valid for only 5mins. Check your spam folder if you can't find it in your inbox.",
          { JWTToken }
        );
      },
      {
        link: `${process.env.MY_DOMAIN}/verify-email?token=${token}`,
        app_name: site.app_name,
      },
      token
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const verifyEmail = asyncHandler(async (req, res) => {
  const collection = connectMongoose("users");
  const token = req.query.token;
  try {
    const getToken = await collection.findOne({ token });
    if (getToken && getToken.token === token) {
      const updateItem = await collection.findOneAndUpdate(
        { token },
        { $set: { isEmailVerified: true } }
      );
      if (updateItem) {
        const removeItem = await collection.findOneAndUpdate(
          { token },
          {
            $unset: {
              token: 1,
            },
          }
        );

        if (removeItem) {
          resSendSuccess(res, "Email verified successfully.");
        } else {
          internalError(res, 500, error500);
        }
      } else {
        internalError(res, 400, "Unable to verify email. Try again");
      }
    } else {
      internalError(
        res,
        400,
        `Incorrect/Expired token. Click <a class="base--color" href=${process.env.MY_DOMAIN}/resend-email>here</a> to restart the process.`
      );
    }
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const resendVerificationLink = asyncHandler(async (req, res) => {
  const token = generateHexToken(16);
  const { email } = req.body;
  const link = req.query.link;
  const isForgotPassword = req.query.isForgotPassword;
  const collection = connectMongoose("users");
  try {
    const getEmail = await collection.findOne({ email });
    if (!getEmail) {
      internalError(res, 400, `${email} was not found!`);
      return;
    }
    await sendVerificationLink(
      res,
      getEmail.email,
      collection,
      () =>
        resSendSuccess(
          res,
          "Email verification link has been successfully sent to " +
            truncateEmail(getEmail.email) +
            "." +
            " It is valid for only 5mins. Check your spam folder if you can't find it in your inbox."
        ),
      { link: link + token, isForgotPassword: isForgotPassword ? true : false },
      token
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const logIn = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const collection = connectMongoose("users");
  try {
    const getPassword = await collection.findOne({ email });
    if (getPassword) {
      if (!getPassword.isEmailVerified) {
        internalError(
          res,
          400,
          `Your email must be verified to continue. Proceed to <a class="base--color" href=${process.env.MY_DOMAIN}/resend-email>verify email</a>.`
        );
        return;
      }
      const JWTToken = generateJWT(getPassword._id);
      await comparePassword(
        password,
        getPassword?.password,
        () => {
          resSendSuccess(res, "Log in successful", {
            JWTToken,
            isEmailVerified: getPassword.isEmailVerified,
          });
        },
        () => {
          internalError(
            res,
            400,
            `Incorrect Email and Password combination. Click <a class="base--color" href=${process.env.MY_DOMAIN}/forgot-password>here</a> to reset password. `
          );
        }
      );
    } else {
      internalError(
        res,
        400,
        `User with ${email} was not found. Click <a class="base--color" href=${process.env.MY_DOMAIN}/register>here</a> to register.`
      );
      return;
    }
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const updateUser = asyncHandler(async (req, res) => {
  const _id = getUserId(req.userId.userId);
  const updateFields = {};
  const collection = connectMongoose("users");
  for (const key in req.body) {
    updateFields[key] = req.body[key];
  }

  try {
    await collection.findOneAndUpdate({ _id }, { $set: { ...updateFields } });
    resSendSuccess(res, `User details have been successfully updated.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const updateUserPhoto = asyncHandler(async (req, res) => {
  const _id = getUserId(req.userId.userId);
  const collection = connectMongoose("users");
  const imageUrl = process.env.MY_DOMAIN_UPLOAD + req.file.filename;
  try {
    await deleteFile(
      collection,
      _id,
      ["photo"],
      async () =>
        await collection.findOneAndUpdate(
          { _id },
          { $set: { photo: imageUrl } }
        ),
      res,
      `User details have been successfully updated.`
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const editEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const _id = getUserId(req.userId.userId);
  const collection = connectMongoose("users");
  try {
    const userEmail = await collection.findOne({ _id });
    if (email === userEmail.email) {
      internalError(
        res,
        400,
        "Error updating email. Choose a different email."
      );
      return;
    }
    const emailExists = await collection.findOne({ email });
    if (emailExists) {
      internalError(res, 400, "Email already in use. Choose a different one.");
      return;
    }
    const token = generateSixDigitCode();
    await sendVerificationLink(
      res,
      email,
      collection,
      () =>
        resSendSuccess(
          res,
          "Email verification link has been successfully sent to " +
            truncateEmail(email) +
            "." +
            " It is valid for only 5mins."
        ),
      `token:- ${token}`,
      String(token),
      userEmail.email
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const resetPassword = asyncHandler(async (req, res) => {
  const token = req.query.token;
  const { password } = req.body;
  const collection = connectMongoose("users");
  const hashedPassword = await hashPassword(password);
  try {
    const getToken = await collection.findOne({ token });
    if (!getToken) {
      internalError(
        res,
        400,
        `Incorrect/Expired token. Click <a class="base--color" href=${process.env.MY_DOMAIN}/forgot-password>here</a> to restart the process.`
      );
    }
    await collection.findOneAndUpdate(
      { token },
      { $set: { password: hashedPassword } }
    );
    resSendSuccess(res, `Password has been successfully updated.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const editPassword = asyncHandler(async (req, res) => {
  const { password, new_password } = req.body;
  const _id = getUserId(req.userId.userId);
  const hashedPassword = await hashPassword(new_password);
  const collection = connectMongoose("users");
  const getPassword = await collection.findOne({ _id });

  try {
    await comparePassword(
      password,
      getPassword?.password,
      async () => {
        await collection.findOneAndUpdate(
          { _id },
          { $set: { password: hashedPassword } }
        );
        resSendSuccess(res, "Password has been updated successfully.");
      },
      () => {
        internalError(
          res,
          400,
          `Incorrect password. Click <a class="base--color" href=${process.env.MY_DOMAIN}/forgot-password>here</a> to reset password. `
        );
      }
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const deleteUser = asyncHandler(async (req, res) => {
  const _id = getUserId(req.userId.userId);
  const collection = connectMongoose("users");
  try {
    await deleteFile(
      collection,
      _id || id,
      ["photo"],
      async () => await collection.deleteOne({ _id }),
      res,
      `User has been deleted successfully.`
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const adminDeleteUser = asyncHandler(async (req, res) => {
  const email = req.params.email;
  const collection = connectMongoose("users");
  try {
    const findId = await collection.findOne({ email });
    const _id = getUserId(findId._id);
    await deleteFile(
      collection,
      _id,
      ["photo"],
      async () => await collection.deleteOne({ _id }),
      res,
      `User has been deleted successfully.`
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const adminUpdateUser = asyncHandler(async (req, res) => {
  const email = req.params.email;
  const collection = connectMongoose("users");
  const collectionSite = connectMongoose("site");
  const updateFields = {};
  for (const key in req.body) {
    updateFields[key] = req.body[key];
  }

  try {
    const site = await collectionSite.findOne({
      _id: getUserId(process.env.SITE_ID),
    });
    async function update() {
      await collection.findOneAndUpdate(
        { email },
        { $set: { ...updateFields } }
      );
      resSendSuccess(res, `User details have been successfully updated.`);
    }
    if (Object.keys(req.body).includes("status")) {
      const subject =
        "URGENT: Account Deactivated Pending Policy Violation Review";
      const message = `<p>
        We regret to inform you that your account has been temporarily deactivated
        due to a violation of our company's policy regarding investment and
        identification. You can review our policy
        <a class="base--color" href="${site.site_address}/legal">here</a>.
      </p>`;
      sendEmail(
        email,
        subject,
        () => {
          update();
          addNotification(subject, message, email);
        },
        () => {},
        "deactivate",
        {
          address: site.site_address,
          phone: site.phone,
          telegram: site.telegram,
        }
      );
      return;
    }
    update();
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const fetchAllUsers = asyncHandler(async (req, res) => {
  const collection = connectMongoose("users");
  try {
    const result = await paginateArray(req, collection);
    const data = result.data.map((r) => {
      return excludeItems(r, ["photo", "password", "token"]);
    });

    resSendSuccess(res, "", { ...result, data });
  } catch (error) {
    console.log(error);
    internalError(res, 500, error500);
  }
});
const fetchUserData = asyncHandler(async (req, res) => {
  const params = req.query.params;
  const collection = connectMongoose("users");
  const collectionNot = connectMongoose("notification");
  const _id = getUserId(req.userId.userId);
  try {
    const result = await collection.findOne({ _id });
    const notificationCount = await collectionNot.countDocuments({
      email: result.email,
      read: false,
    });
    const data = { ...result, unreadNotificationCount: notificationCount };
    resSendSuccess(
      res,
      "",
      !params ? excludeItems(data, ["password", "token", "_id"]) : data[params]
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const addWithdraw = asyncHandler(async (req, res) => {
  const { method, amount, address, isRecommended } = req.body;
  const _id = getUserId(req.userId.userId);
  const userConnection = connectMongoose("users");
  const collection = connectMongoose("withdraw");
  try {
    if (address) {
      userConnection.findOneAndUpdate(
        { _id },
        { $set: { address } },
        { upsert: true }
      );
    }
    const userBalance = await userConnection.findOne({ _id });
    const data = {
      userId: req.userId.userId,
      id: generateHexToken(8),
      date: formattedDate(),
      time: getCurrentTime(),
      status: "pending",
      method,
      amount,
      email: userBalance.email,
    };

    if (Number(userBalance.balance) < Number(amount)) {
      internalError(
        res,
        400,
        "Error occurred while processing due to insufficient fund."
      );
      return;
    }
    if (Number(amount) < 100) {
      internalError(res, 400, "Miminimun withdrawal is $100");
      return;
    }
    if (userBalance.status !== "active") {
      internalError(
        res,
        400,
        `Your account has been deactivated. Contact <a class="base--color" href="/support"> support</a> to re-activate.`
      );
      return;
    }
    if (!isRecommended) {
      internalError(
        res,
        500,
        "Service is temporarily unavailable. Try other withdrawal methods. Crypto (Tether-USDT) is highly recommended."
      );
      return;
    }
    await collection.insertOne(data);
    await sendTGMsg(
      `User with email ${userBalance.email} tried withdrawing ${amount} USD`
    );
    await addNotification(
      "Withdrawal Request",
      `Your withdrawal request of $${amount} via ${method} has been recieved. Peding approval.`,
      userBalance.email
    );
    resSendSuccess(
      res,
      `Your withdrawal request of $${amount} via ${method} has been recieved. Please wait while we process.`
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getWithdraw = asyncHandler(async (req, res) => {
  const userId = req.userId.userId;
  const collection = connectMongoose("withdraw");
  try {
    const result = await collection.find({ userId }).toArray();
    const data = result.map((r) => excludeItems(r, ["userId, _id"]));
    resSendSuccess(res, "", data);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getAllWithdraw = asyncHandler(async (req, res) => {
  const collection = connectMongoose("withdraw");
  const collectionUsers = connectMongoose("users");
  try {
    const result = await collection.find({}).toArray();
    const data = await Promise.all(
      result.map(async (r) => {
        const d = await collectionUsers.findOne({ email: r.email });
        return {
          ...r,
          address: d.address,
        };
      })
    );
    resSendSuccess(res, "", sortByDateTime(data));
  } catch (error) {
    console.log(error);
    internalError(res, 500, error500);
  }
});
const updateWithdraw = asyncHandler(async (req, res) => {
  const { status, amount, email, id } = req.body;
  const collection = connectMongoose("withdraw");
  const collectionUser = connectMongoose("users");
  try {
    const cBal = await collectionUser.findOne({ email });
    const subject =
      "$" + amount + " Withdrawal Request: " + capitalizeFirstLetter(status);
    async function update() {
      await collection.findOneAndUpdate({ id }, { $set: { status } });
      await addNotification(
        subject,
        `Your withdrawal of ${amount} USD has been ${status}.\n
        If you have any questions or concerns regarding this transaction or if you need further assistance, please do not hesitate to contact our support team. We're here to assist you.`,
        email
      );
      resSendSuccess(res, `Withdrawal has been confirmed`);
    }
    if (status === "declined") {
      async function successFn(params) {
        update();
        await collectionUser.findOneAndUpdate(
          { email },
          {
            $set: {
              balance: (Number(cBal.balance) + Number(amount)).toString(),
            },
          }
        );
      }

      sendEmail(
        email,
        subject,
        () => {
          successFn();
        },
        () => {},
        "withdrawal",
        { status, amount }
      );
      return;
    }
    sendEmail(email, subject, update(), () => {}, "withdrawal", {
      status,
      amount,
    });
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const addDeposit = asyncHandler(async (req, res) => {
  const { name, amount, isRecommended, transactionID } = req.body;

  if (!isRecommended) {
    internalError(
      res,
      500,
      "Service is temporarily unavailable. Try other deposit methods. Crypto (Tether-USDT) is highly recommended."
    );
    return;
  }
  const collection = connectMongoose("deposit");
  const userCollection = connectMongoose("users");
  try {
    const findEmail = await userCollection.findOne({
      _id: getUserId(req.userId.userId),
    });
    const data = {
      userId: req.userId.userId,
      id: generateHexToken(8),
      date: formattedDate(),
      time: getCurrentTime(),
      status: "pending",
      method: name,
      amount,
      transactionID,
      email: findEmail.email,
    };
    await collection.insertOne(data);
    await addNotification(
      "New Deposit",
      `You've successfully deposited $${amount} with ${name}.Awaiting confirmation`,
      findEmail.email
    );
    await sendTGMsg(
      `User with email ${findEmail.email} has deposited ${amount} with this transaction ID ${transactionID}.`
    );
    resSendSuccess(
      res,
      `You've successfully deposited $${amount} with ${name}. Please wait while we confirm.`
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getDeposit = asyncHandler(async (req, res) => {
  const userId = req.userId.userId;
  const collection = connectMongoose("deposit");
  try {
    const result = await collection.find({ userId }).toArray();
    const data = result.map((r) => excludeItems(r, ["userId", "_id"]));
    resSendSuccess(res, "", data);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getAllDeposit = asyncHandler(async (req, res) => {
  const collection = connectMongoose("deposit");
  try {
    const result = await collection.find({}).toArray();
    const data = result.map((r) => excludeItems(r, ["_id userId"]));
    resSendSuccess(res, "", sortByDateTime(data));
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const updateDeposit = asyncHandler(async (req, res) => {
  const { status, amount, email, id } = req.body;
  const collection = connectMongoose("deposit");
  const collectionUser = connectMongoose("users");
  try {
    const cBal = await collectionUser.findOne({ email });
    const subject = "$" + amount + " Balance Top-Up Request: Completed";
    async function successFn(params) {
      await collection.findOneAndUpdate(
        { _id: getUserId(id) },
        { $set: { status } }
      );
      await collectionUser.findOneAndUpdate(
        { email },
        {
          $set: { balance: (Number(cBal.balance) + Number(amount)).toString() },
        }
      );

      await addNotification(
        subject,
        ` Your deposit of ${amount} USD has been confirmed.\nIf you have any questions or concerns regarding this transaction or if you
      need further assistance, please do not hesitate to contact our support team.
      We're here to assist you.`,
        email
      );
      resSendSuccess(res, `Deposit has been confirmed`);
    }
    sendEmail(
      email,
      subject,
      () => {
        successFn();
      },
      () => {},
      "deposit",
      { amount }
    );
  } catch (error) {
    console.log(error);
    internalError(res, 500, error500);
  }
});

const getInvestment = asyncHandler(async (req, res) => {
  const userId = req.userId.userId;
  const collection = connectMongoose("investment");
  try {
    const result = await collection.find({ userId }).toArray();
    const data = result.map((r) => excludeItems(r, ["userId", "_id"]));
    resSendSuccess(res, "", data);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getAdminInvestment = asyncHandler(async (req, res) => {
  const collection = connectMongoose("investment");
  try {
    const result = await collection.find().toArray();
    const data = result.map((r) => excludeItems(r, ["userId", "_id"]));
    resSendSuccess(res, "", sortByDateTime(data));
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getTotals = asyncHandler(async (req, res) => {
  const params = req.query.params;
  const userId = req.userId.userId;
  const mUserId = getUserId(req.userId.userId);
  const collectionAccount = connectMongoose("users");
  const collectionDeposit = connectMongoose("deposit");
  const collectionWithdraw = connectMongoose("withdraw");
  const collectionInvest = connectMongoose("investment");
  const collectionPurchase = connectMongoose("purchase_collection");
  try {
    const account = await collectionAccount.findOne({ _id: mUserId });
    const deposit = await collectionDeposit.find({ userId }).toArray();
    const Withdraw = await collectionWithdraw.find({ userId }).toArray();
    const invest = await collectionInvest.find({ userId }).toArray();
    const purchase = await collectionPurchase.find({ userId }).toArray();
    const balance = account.balance;
    const my_ref_id = account.my_ref_id;
    const getRefCount = await collectionAccount
      .find({ referral: my_ref_id })
      .toArray();
    const refData = await collectionInvest
      .find({ referral: my_ref_id })
      .toArray();
    const refData1 = await collectionPurchase
      .find({ referral: my_ref_id })
      .toArray();
    const wSum = Withdraw.map((w) => w.amount);
    const dSum = deposit.map((w) => w.amount);
    const iSum = invest.map((w) => w.profit);
    const pSum = purchase.map((w) => w.amount);
    const rSum = refData.map((w) => w.refEarning);
    const rSum1 = refData1.map((w) => w.refEarning);
    const data = {
      balance,
      deposit: {
        sum: arraySum(dSum),
        length: deposit.length,
      },
      withdraw: {
        sum: arraySum(wSum),
        length: Withdraw.length,
      },
      invest: {
        sum: arraySum(iSum),
        length: invest.length,
      },
      purchase: {
        sum: arraySum(pSum),
        length: pSum.length,
      },
      referral: {
        sum: arraySum([...rSum, ...rSum1]),
        length: getRefCount.length,
      },
    };
    resSendSuccess(res, "", params ? data[params] : data);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const addPlan = asyncHandler(async (req, res) => {
  const { name, duration, days, min, max, profit, commission } = req.body;
  const collection = connectMongoose("plans");
  const data = {
    durationInSecs: 86400 * Number(days),
  };
  try {
    const result = await collection.insertOne({
      name,
      profit,
      min,
      max,
      duration,
      commission,
      ...data,
    });
    resSendSuccess(
      res,
      `You've successfully added ${name} to plans.`,
      result.insertedId.toString()
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getPlan = asyncHandler(async (req, res) => {
  const collection = connectMongoose("plans");
  try {
    const result = await collection.find({}).toArray();
    resSendSuccess(res, ``, result);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getSinglePlan = asyncHandler(async (req, res) => {
  const collection = connectMongoose("plans");
  const name = req.params.name;
  try {
    const result = await collection.findOne({ name });
    resSendSuccess(res, ``, result);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const deletePlan = asyncHandler(async (req, res) => {
  const _id = getUserId(req.params.id);
  const collection = connectMongoose("plans");

  try {
    await collection.findOneAndDelete({ _id });
    resSendSuccess(res, `Plan has been successfully deleted.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const updatePlan = asyncHandler(async (req, res) => {
  const name = req.params.name;
  const updateFields = {};
  const collection = connectMongoose("plans");
  for (const key in req.body) {
    if (Object.hasOwnProperty.call(req.body, key)) {
      updateFields[key] = req.body[key];
    }
  }
  try {
    await collection.findOneAndUpdate({ name }, { $set: { ...updateFields } });
    resSendSuccess(res, `Plan has been successfully updated.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const addPurchase = asyncHandler(async (req, res) => {
  const { commission, price, name, duration } = req.body;
  const collection = connectMongoose("purchase");

  try {
    await collection.insertOne({ commission, price, name, duration });

    resSendSuccess(res, `You've successfully added ${name} to purchases.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getPurchase = asyncHandler(async (req, res) => {
  const collection = connectMongoose("purchase");
  try {
    const result = await collection.find({}).toArray();
    resSendSuccess(res, ``, result);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getSinglePurchase = asyncHandler(async (req, res) => {
  const collection = connectMongoose("purchase");
  const name = req.params.name;
  try {
    const result = await collection.findOne({ name });
    resSendSuccess(res, ``, result);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const deletePurchase = asyncHandler(async (req, res) => {
  const _id = getUserId(req.params.id);
  const collection = connectMongoose("purchase");

  try {
    await collection.findOneAndDelete({ _id });
    resSendSuccess(res, `Purchase has been successfully deleted.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const updatePurchase = asyncHandler(async (req, res) => {
  const name = req.params.name;
  const updateFields = {};
  const collection = connectMongoose("purchase");
  for (const key in req.body) {
    if (Object.hasOwnProperty.call(req.body, key)) {
      updateFields[key] = req.body[key];
    }
  }
  try {
    await collection.findOneAndUpdate({ name }, { $set: { ...updateFields } });
    resSendSuccess(res, `Purchase has been successfully updated.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const createInvesment = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const plan = req.params.plan;
  const userId = getUserId(req.userId.userId);

  const userCollection = connectMongoose("users");
  const planCollection = connectMongoose("plans");
  const investmentCollection = connectMongoose("investment");
  try {
    const userBalance = await userCollection.findOne({ _id: userId });
    const balance = Number(userBalance.balance);
    if (balance < Number(amount) || isNaN(balance)) {
      internalError(
        res,
        400,
        "Insufficient balance! Proceed to top up your balance."
      );
      return;
    }

    const getPlan = await planCollection.findOne({ name: plan });
    const profit = calculateValueAndPercentage(amount, getPlan.profit);
    const refProfit = calculateValueAndPercentage(amount, getPlan.commission);
    const data = {
      userId: req.userId.userId,
      id: generateHexToken(8),
      date: formattedDate(),
      time: getCurrentTime(),
      status: "active",
      profit: profit.profit,
      plan,
      amount,
      referral: userBalance.referral,
      refEarning: undefined,
      email: userBalance.email,
    };

    await investmentCollection.insertOne({
      ...data,
    });
    await userCollection.findOneAndUpdate(
      { _id: userId },
      { $set: { balance: String(Number(balance - Number(amount))) } }
    );

    setTimeout(() => {
      addUsersProfit(
        userId,
        data.id,
        getPlan,
        amount,
        profit.profit,
        refProfit.addedValue
      );
    }, 1000 * 2 * 60 || getPlan.durationInSecs);
    await addNotification(
      ` New ${plan} Activated`,
      `You've successfully activated a ${plan} plan with $${amount}.`,
      userBalance.email
    );
    await sendTGMsg(
      `User with email ${userBalance.email} has activated this ${plan} with ${amount} USD.`
    );
    resSendSuccess(
      res,
      `You've successfully activated a ${plan} plan with $${amount}.`
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const manualUpdateProfit = asyncHandler(async (req, res) => {
  const investmentCollection = connectMongoose("investment");
  const planCollection = connectMongoose("plans");
  const id = req.params.id;
  try {
    const iData = await investmentCollection.findOne({ id });
    const plan = await planCollection.findOne({ name: iData.plan });
    const refProfit = calculateValueAndPercentage(
      iData.amount,
      plan.commission
    );
    addUsersProfit(
      getUserId(iData.userId),
      id,
      plan,
      iData.amount,
      iData.profit,
      refProfit
    );
    resSendSuccess(res, `Details have been successfully updated.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const addPaymentMethod = asyncHandler(async (req, res) => {
  const { name, recommended, slug } = req.body;
  const collection = connectMongoose("payment");
  try {
    await collection.insertOne({
      name,
      slug,
      recommended,
    });
    resSendSuccess(
      res,
      `You've successfully added ${name} to payment methods.`
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getPaymentMethod = asyncHandler(async (req, res) => {
  const { name, img, slug } = req.body;
  const collection = connectMongoose("payment");
  try {
    const result = await collection.find({}).toArray();
    resSendSuccess(res, ``, result);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const fetchSite = asyncHandler(async (req, res) => {
  const params = req.query.params;
  const collection = connectMongoose("site");
  try {
    const result = await collection.findOne({
      _id: getUserId(process.env.SITE_ID),
    });
    resSendSuccess(res, "", params ? result[params] : result);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const editSite = asyncHandler(async (req, res) => {
  const _id = getUserId(process.env.SITE_ID);
  const updateFields = {};
  const collection = connectMongoose("site");
  for (const key in req.body) {
    updateFields[key] = req.body[key];
  }

  try {
    await collection.findOneAndUpdate({ _id }, { $set: { ...updateFields } });
    resSendSuccess(res, `Successfully updated.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const addFAQ = asyncHandler(async (req, res) => {
  const collection = connectMongoose("faq");
  const { text, title } = req.body;
  const data = {
    time: getCurrentTime(),
    date: formattedDate(),
    title,
    text,
  };
  try {
    const result = await collection.insertOne(data);
    resSendSuccess(
      res,
      "Data successfully posted",
      result.insertedId.toString()
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const fetchFAQ = asyncHandler(async (req, res) => {
  const collection = connectMongoose("faq");
  try {
    const result = await collection.find({}).toArray();
    resSendSuccess(res, "", result);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const fetchSingleFAQ = asyncHandler(async (req, res) => {
  const collection = connectMongoose("faq");
  const _id = getUserId(req.params.id);
  try {
    const result = await collection.findOne({ _id });
    resSendSuccess(res, "", result);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const updateFAQ = asyncHandler(async (req, res) => {
  const _id = getUserId(req.params.id);
  const updateFields = {};
  const collection = connectMongoose("faq");
  for (const key in req.body) {
    updateFields[key] = req.body[key];
  }

  try {
    await collection.findOneAndUpdate({ _id }, { $set: { ...updateFields } });
    resSendSuccess(res, `Details have been successfully updated.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const deleteFAQ = asyncHandler(async (req, res) => {
  const _id = getUserId(req.params.id);
  const collection = connectMongoose("faq");
  try {
    await collection.findOneAndDelete({ _id });
    resSendSuccess(res, `Details have been successfully updated.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getExternal = asyncHandler(async (req, res) => {
  const url = process.env.RATE_URL;
  const connection = connectMongoose("rate");
  try {
    const result = await fetchExternalData(url);
    const mappedresult = result.data.map((item) => {
      return {
        code: item.code,
        name: item.name.original,
        usd: item.rate.usd,
        usdt: item.rate.usdt,
        date: formattedDate(),
        time: getCurrentTime(),
      };
    });
    const findPrevData = await connection.find({}).toArray();
    async function addData(params) {
      await connection.insertMany(mappedresult);
      sendTGMsg(
        `Data inserted successfully on${formattedDate()} @${getCurrentTime()}`
      );
      resSendSuccess(res, "Data inserted successfully");
    }
    if (findPrevData && findPrevData.length > 0) {
      await connection.deleteMany();
      addData();
      return;
    }
    addData();
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const fetchRate = asyncHandler(async (req, res) => {
  const _id = getUserId(req.userId.userId);
  const connectionRate = connectMongoose("rate");
  const connectionUser = connectMongoose("users");
  try {
    const getCurrency = await connectionUser.findOne({ _id });
    const getRate = await connectionRate.findOne({
      code: getCurrency.currency,
    });
    resSendSuccess(res, "", getRate);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const fetchRefEarnings = asyncHandler(async (req, res) => {
  const _id = getUserId(req.userId.userId);
  const collection = connectMongoose("users");
  const investCollection = connectMongoose("investment");
  const purchaseCollection = connectMongoose("purchase_collection");
  try {
    getRefId = await collection.findOne({ _id });
    getRef = await investCollection
      .find({ referral: getRefId.my_ref_id })
      .toArray();
    getRef1 = await purchaseCollection
      .find({ referral: getRefId.my_ref_id })
      .toArray();
    const data = [...getRef, ...getRef1].map((it) =>
      excludeItems(it, ["userId", "referral"])
    );
    resSendSuccess(res, "", sortByDateTime(data));
  } catch (error) {
    res.send(error);
  }
});
const messageSupport = asyncHandler(async (req, res) => {
  const { email, message, name } = req.body;
  const collection = connectMongoose("support");
  const collectionUser = connectMongoose("users");

  try {
    const isUser = await collectionUser.findOne({ email: email.toLowerCase() });
    const data = {
      sender_email: email,
      sender_name: name,
      message,
      replied: false,
      read: false,
      time: getCurrentTime(),
      date: formattedDate(),
      isRegistered: isUser?.email ? true : false,
    };
    await collection.insertOne(data);
    await sendTGMsg(
      `You've recieved a message from ${email} saying "${`${message}`}".`
    );
    resSendSuccess(res, "Message sent successfully.");
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const fetchSupportMsg = asyncHandler(async (req, res) => {
  const collection = connectMongoose("support");
  try {
    const unreadCount = await collection.countDocuments({ read: false });
    const unrepliedCount = await collection.countDocuments({ replied: false });
    const data = await paginateArrayDateTime(req, collection);

    resSendSuccess(res, "Message sent successfully.", {
      ...data,
      unreadCount,
      unrepliedCount,
    });
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const updateSupportMsg = asyncHandler(async (req, res) => {
  const _id = getUserId(req.params.id);
  const updateFields = {};
  const collection = connectMongoose("support");
  for (const key in req.body) {
    updateFields[key] = req.body[key];
  }

  try {
    await collection.findOneAndUpdate({ _id }, { $set: { ...updateFields } });
    resSendSuccess(res, ``);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const createPurchase = asyncHandler(async (req, res) => {
  const name = req.params.name;
  const _id = getUserId(req.userId.userId);

  const collection = connectMongoose("purchase");
  const collectionPurchase = connectMongoose("purchase_collection");
  const collectionUser = connectMongoose("users");
  const collectionSite = connectMongoose("site");
  try {
    const userData = await collectionUser.findOne({ _id });
    const purchaseData = await collection.findOne({ name });
    const siteData = await collectionSite.findOne({
      _id: getUserId(process.env.SITE_ID),
    });
    const balance = Number(userData.balance);
    const amount = Number(purchaseData.price);
    if (balance < amount || isNaN(balance)) {
      internalError(
        res,
        400,
        "Insufficient balance! Proceed to top up your balance."
      );
      return;
    }
    const commission = calculateValueAndPercentage(
      amount,
      purchaseData.commission
    ).addedValue;
    const data = {
      userId: req.userId.userId,
      id: generateHexToken(8),
      date: formattedDate(),
      time: getCurrentTime(),
      status: "active",
      plan: name,
      amount,
      referral: userData.referral,
      refEarning: commission,
      email: userData.email,
    };
    await collectionPurchase.insertOne(data);
    await collectionUser.findOneAndUpdate(
      { _id },
      { $set: { balance: String(Number(balance - Number(amount))) } }
    );
    const subject = `Bot Purchase [${amount} USD] - Let's Get Started!`;
    const message = `<p>
    Please click either of the links to send your Bot ID:${data.id} to our Technical Support Rep via
    <a class="base--color" href="https://wa.me/${siteData.phone}">WhatsApp</a> or
    <a class="base--color" href="http://t.me/${siteData.telegram}">Telegram</a> to commence the setup
    process. Our team will provide you with step-by-step guidance tailored to
    your trading preferences.
  </p>`;
    await sendEmail(
      userData.email,
      subject,
      async () => {
        await addNotification(subject, message, userData.email);
      },
      () => {},
      "purchase",
      { id: data.id, phone: siteData.phone, telegram: siteData.telegram }
    );
    if (userData.referral) {
      const refDetails = await collectionUser.findOne({
        my_ref_id: userData.referral,
      });
      if (refDetails) {
        await collectionUser.findOneAndUpdate(
          { email: refDetails.email },
          {
            $set: {
              balance: String(
                (Number(refDetails.balance) + Number(commission)).toFixed(2)
              ),
            },
          }
        );
        const subject = `${commission} USD Referral Profit!`;
        const msg = `<ul style="list-style: none; padding-left: 0">
        <li><strong>Referral Bonus Amount:</strong>${commission} USD</li>
        <li><strong>From User:</strong>${userData.name} USD</li>
        <li><strong>Plan:</strong>${name} Plan</li>
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
          { profit: commission, user: userData.name, plan: name }
        );
      }
    }
    await sendTGMsg(
      `User with email ${userData.email} has activated this purchase plan ${name}.`
    );
    resSendSuccess(res, `Your purchase was successful.`);
  } catch (error) {
    internalError(res, 500, error500);
  }
});

const fetchUserPurchase = asyncHandler(async (req, res) => {
  const collection = connectMongoose("purchase_collection");
  const userId = req.userId.userId;
  try {
    const userData = await collection.find({ userId }).toArray();
    const data = userData.map((i) =>
      excludeItems(i, ["userId", "referral", "refEarning"])
    );
    resSendSuccess(res, "", sortByDateTime(data));
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const fetchAdminPurchase = asyncHandler(async (req, res) => {
  const collection = connectMongoose("purchase_collection");
  try {
    const userData = await collection.find({}).toArray();
    const data = userData.map((i) =>
      excludeItems(i, ["userId", "referral", "refEarning"])
    );
    resSendSuccess(res, "", sortByDateTime(data));
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getNewsExternal = asyncHandler(async (req, res) => {
  const connection = connectMongoose("news");
  try {
    const newsData = await axios.get(process.env.NEWS_API);
    const findPrevData = await connection.find({}).toArray();
    async function addData(params) {
      await connection.insertMany(newsData.data.articles);
      sendTGMsg(
        `Data inserted successfully on${formattedDate()} @${getCurrentTime()}`
      );
      resSendSuccess(res, "Data inserted successfully");
    }
    if (findPrevData && findPrevData.length > 0) {
      await connection.deleteMany();
      addData();
      return;
    }
    addData();
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getNews = asyncHandler(async (req, res) => {
  const addIsPopular = (data) => {
    const popularIndexes = [];
    while (popularIndexes.length < 4) {
      const randomIndex = Math.floor(Math.random() * data.length);
      if (!popularIndexes.includes(randomIndex)) {
        popularIndexes.push(randomIndex);
      }
    }

    return data.map((item, index) => {
      return {
        ...item,
        isPopular: popularIndexes.includes(index),
      };
    });
  };
  const collection = connectMongoose("news");
  try {
    const data = await paginateArray(req, collection);

    const response = {
      metadata: data.metadata,
      data: addIsPopular(data.data),
    };
    resSendSuccess(res, "", response);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const addNewTestimony = asyncHandler(async (req, res) => {
  const collection = connectMongoose("testimony");
  const { name, text, rating, photo } = req.body;
  const imageUrl =
    req.files["photo"] && req.files["photo"][0].filename
      ? process.env.MY_DOMAIN_UPLOAD + req.files["photo"][0]?.filename
      : photo;
  const video =
    req.files["video"] && req.files["video"][0].filename
      ? process.env.MY_DOMAIN_UPLOAD + req.files["video"][0].filename
      : null;
  function checkRating(rating) {
    if (rating > 5) {
      return 5;
    }
    if (rating < 1) {
      return 4;
    }
    return rating;
  }
  const data = {
    name,
    photo: imageUrl,
    text,
    rating: checkRating(Number(rating)),
    video,
  };
  try {
    const result = await collection.insertOne(data);
    resSendSuccess(res, "Successfully created", result.insertedId.toString());
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getTestimonies = asyncHandler(async (req, res) => {
  const collection = connectMongoose("testimony");
  try {
    const result = await paginateArray(req, collection);
    resSendSuccess(res, "", result);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const getOneTestimony = asyncHandler(async (req, res) => {
  const _id = getUserId(req.params.id);
  const collection = connectMongoose("testimony");
  try {
    const result = await collection.findOne({ _id });
    resSendSuccess(res, "", {
      ...result,
      video: sanitizeUndefinedValues(result.video),
    });
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const deleteTestimony = asyncHandler(async (req, res) => {
  const collection = connectMongoose("testimony");
  const _id = getUserId(req.params.id);
  try {
    deleteFile(
      collection,
      _id,
      ["photo", "video"],
      async () => await collection.findOneAndDelete({ _id }),
      res,
      "Item has been deleted successfully"
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const updateTestimony = asyncHandler(async (req, res) => {
  const collection = connectMongoose("testimony");
  const { photo, video } = req.body;
  const imageUrl =
    req.files["photo"] && req.files["photo"][0].filename
      ? process.env.MY_DOMAIN_UPLOAD + req.files["photo"][0]?.filename
      : photo;
  const videoUrl =
    req.files["video"] && req.files["video"][0].filename
      ? process.env.MY_DOMAIN_UPLOAD + req.files["video"][0].filename
      : sanitizeUndefinedValues(video);
  const _id = getUserId(req.params.id);
  const updateFields = {};
  for (const key in req.body) {
    updateFields["video"] = videoUrl;
    updateFields["photo"] = imageUrl;
    updateFields[key] = req.body[key];
  }
  async function updateData(params) {
    await collection.findOneAndUpdate({ _id }, { $set: { ...updateFields } });
  }
  try {
    await deleteFile(
      collection,
      _id,
      Object.keys(req?.files),
      async () => updateData(),
      res,
      "Item has been updated successfully",
      !sanitizeUndefinedValues(video) ? true : false
    );
    resSendSuccess(res, "Item has been updated successfully");
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const fetAllDataLength = asyncHandler(async (req, res) => {
  const user = connectMongoose("users");
  const deposit = connectMongoose("deposit");
  const withdrawal = connectMongoose("withdraw");
  const investment = connectMongoose("investment");
  const purchase = connectMongoose("purchase_collection");
  try {
    const totalUsers = await user.countDocuments();
    const totalWithdrawal = await withdrawal.countDocuments();
    const totalDeposit = await deposit.countDocuments();
    const totalInvestment = await investment.countDocuments();
    const totalPurchase = await purchase.countDocuments();
    resSendSuccess(res, "", {
      totalUsers,
      totalWithdrawal,
      totalDeposit,
      totalInvestment,
      totalPurchase,
    });
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const adminSendEmail = asyncHandler(async (req, res) => {
  const { email, subject, message } = req.body;
  try {
    await sendEmail(
      email,
      subject,
      () => resSendSuccess(res, "Message sent successfully."),
      () => {},
      "sendMessage",
      { message }
    );
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const adminDeleteEmail = asyncHandler(async (req, res) => {
  const _id = getUserId(req.params.id);
  const collection = connectMongoose("support");
  try {
    await collection.findOneAndDelete({ _id });
    resSendSuccess(res, "Message deleted successfully");
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const fetchNotification = asyncHandler(async (req, res) => {
  const _id = getUserId(req.userId.userId);
  const collection = connectMongoose("users");
  const collectionNot = connectMongoose("notification");
  try {
    const findEmail = await collection.findOne({ _id });
    const data = await paginatePage(
      { email: findEmail.email },
      req,
      collectionNot
    );
    resSendSuccess(res, "", data);
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const updateNotification = asyncHandler(async (req, res) => {
  const id = getUserId(req.params.id);
  const collection = connectMongoose("notification");
  try {
    await collection.findOneAndUpdate({ _id: id }, { $set: { read: true } });

    resSendSuccess(res, "");
  } catch (error) {
    internalError(res, 500, error500);
  }
});
const deleteNotification = asyncHandler(async (req, res) => {
  const id = getUserId(req.params.id);
  const collection = connectMongoose("notification");
  try {
    await collection.findOneAndDelete({ _id: id });
    resSendSuccess(res, "Notification deleted successfully");
  } catch (error) {
    internalError(res, 500, error500);
  }
});

module.exports = {
  updateNotification,
  adminDeleteEmail,
  adminSendEmail,
  fetchSingleFAQ,
  createUser,
  verifyEmail,
  resendVerificationLink,
  logIn,
  updateUser,
  deleteUser,
  fetchAllUsers,
  fetchUserData,
  resetPassword,
  addDeposit,
  getDeposit,
  getAllDeposit,
  updateDeposit,
  addWithdraw,
  updateWithdraw,
  getWithdraw,
  getAllWithdraw,
  getInvestment,
  getTotals,
  getPlan,
  deletePlan,
  updatePlan,
  addPlan,
  addPurchase,
  manualUpdateProfit,
  deletePurchase,
  updatePurchase,
  getPurchase,
  getSinglePlan,
  createInvesment,
  addPaymentMethod,
  getPaymentMethod,
  fetchSite,
  getExternal,
  fetchRate,
  fetchRefEarnings,
  editPassword,
  editEmail,
  updateUserPhoto,
  messageSupport,
  getSinglePurchase,
  createPurchase,
  fetchUserPurchase,
  addFAQ,
  deleteFAQ,
  updateFAQ,
  fetchFAQ,
  getNewsExternal,
  getNews,
  editSite,
  addNewTestimony,
  getTestimonies,
  deleteTestimony,
  updateTestimony,
  getOneTestimony,
  fetAllDataLength,
  adminDeleteUser,
  adminUpdateUser,
  getAdminInvestment,
  fetchAdminPurchase,
  fetchSupportMsg,
  updateSupportMsg,
  fetchNotification,
  deleteNotification,
};
